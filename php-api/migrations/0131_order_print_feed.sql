-- Replayable index for the internal order-confirmation feed; no order data is changed.
SET @has_orders := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ws_orders');
SET @has_print_index := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='ws_orders' AND index_name='idx_orders_print_feed');
SET @order_print_sql := IF(@has_orders=1 AND @has_print_index=0,
 'CREATE INDEX idx_orders_print_feed ON ws_orders (shop_id, created_at, id)', 'DO 0');
PREPARE order_print_statement FROM @order_print_sql;
EXECUTE order_print_statement;
DEALLOCATE PREPARE order_print_statement;
