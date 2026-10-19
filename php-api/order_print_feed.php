<?php
/** Internal, read-only feed for ERP order printing. No browser/customer token is accepted. */
function order_print_feed_authorized(string $configured, string $authorization): bool
{
    return strlen($configured) >= 32 && hash_equals('Bearer '.$configured, $authorization);
}

function order_print_feed(PDO $pdo, array $query): array
{
    $shop = filter_var($query['shop_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $after = filter_var($query['after'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
    $from = order_print_feed_time($query['from'] ?? null);
    $until = order_print_feed_time($query['until'] ?? null);
    $liveUntil = order_print_feed_time($query['live_until'] ?? $query['until'] ?? null);
    if ($liveUntil < $until) throw new InvalidArgumentException('Invalid live range');
    if ($shop === false || $after === false || $from > $until) throw new InvalidArgumentException('Invalid order feed range');
    // ws_orders.created_at is TIMESTAMP: compare in UTC, independent of server/session DST.
    $pdo->exec("SET time_zone = '+00:00'");
    $hasSource = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ws_orders' AND column_name='source'")->fetchColumn();
    $sql = "SELECT o.id, o.order_ref, o.created_at, o.delivery_date, o.slot_label,
            COALESCE(NULLIF(CASE WHEN c.is_b2b=1 THEN COALESCE(NULLIF(c.company_name,''),TRIM(CONCAT(COALESCE(c.name,''),' ',COALESCE(c.surname,'')))) ELSE TRIM(CONCAT(COALESCE(c.name,''),' ',COALESCE(c.surname,''))) END,''), o.guest_name, '') AS client_name,
            COALESCE(c.is_b2b,0) AS is_b2b
            FROM ws_orders o LEFT JOIN client c ON c.id=o.customer_id
            WHERE o.shop_id=? AND o.created_at>=? AND o.created_at<=? AND o.id>?";
    if ($hasSource) $sql .= " AND o.source='webshop'";
    $sql .= ' ORDER BY o.id LIMIT 101';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$shop, $from, $until, $after]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $more = count($rows) > 100;
    if ($more) array_pop($rows);
    $map = function (array $records) use ($pdo): array {
        $orders = [];
        $lines = $pdo->prepare('SELECT product_name AS name, qty AS quantity, `portion`, note FROM ws_order_lines WHERE order_id=? ORDER BY id');
        foreach ($records as $record) {
            $lines->execute([$record['id']]);
            $products = $lines->fetchAll(PDO::FETCH_ASSOC);
            if (!$products) throw new RuntimeException('Order has no products');
            $orders[] = [
                'order_id' => (int)$record['id'], 'reference' => (string)$record['order_ref'],
                'created_at' => str_replace(' ', 'T', $record['created_at']).'Z',
                'client_name' => (string)$record['client_name'], 'client_type' => (int)$record['is_b2b'] === 1 ? 'B2B' : 'B2C',
                'pickup_date' => (string)$record['delivery_date'], 'pickup_time' => (string)$record['slot_label'],
                'products' => $products,
            ];
        }
        return $orders;
    };
    $orders = $map($rows);
    // Prioritise current arrivals even while reconciling a large historic range.
    $recentSql = str_replace([' AND o.id>?', ' ORDER BY o.id LIMIT 101'], ['', ' ORDER BY o.id DESC LIMIT 100'], $sql);
    $recent = $pdo->prepare($recentSql);
    $recent->execute([$shop, $from, $liveUntil]);
    return ['orders' => $orders, 'recent_orders' => $map($recent->fetchAll(PDO::FETCH_ASSOC)),
        'next_after' => $orders ? $orders[count($orders)-1]['order_id'] : $after, 'has_more' => $more];
}

function order_print_feed_time(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/D', $value)) throw new InvalidArgumentException('Invalid UTC timestamp');
    $d = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $value, new DateTimeZone('UTC'));
    if (!$d || $d->format('Y-m-d\TH:i:s\Z') !== $value) throw new InvalidArgumentException('Invalid UTC timestamp');
    return $d->format('Y-m-d H:i:s');
}
