<?php
/**
 * E-mail « Confirmation de commande » — L'Atelier By.
 * Même charte que les e-mails du CRM : tableau 600 px, liseré bordeaux, logo,
 * pied de page, styles en ligne (Gmail, Outlook, Apple Mail).
 *
 * Usage :
 *   require 'commande_mail.php';
 *   [$subject, $html, $text] = commande_mail([
 *       'numero'   => 'WEB-2-20260916-47B8C4',
 *       'prenom'   => 'Sophie',                        // facultatif
 *       'retrait'  => '2026-09-16 14:00:00',           // date + heure de début
 *       'creneau'  => '14:00–15:00',
 *       'boutique' => "L'Atelier By — Corbais",
 *       'adresse'  => 'Rue de la Gare 12, 1435 Corbais',
 *       'lignes'   => [                                // facultatif
 *           ['libelle' => 'Tarte au sucre', 'qte' => 1, 'prix' => 2.00],
 *       ],
 *       'total'    => 2.00,
 *       'paye'     => true,                            // payée en ligne ?
 *       'note'     => '',                              // remarque du client (facultatif)
 *       'lien'     => 'https://shop.atelierby.be/commande/WEB-2-20260916-47B8C4', // facultatif
 *       'contact'  => 'corbais@atelierby.be',
 *       'logo'     => 'https://www.atelierby.be/crm/img/logo.png',   // URL ABSOLUE
 *   ]);
 *   // Envoi : $html en text/html, $text en text/plain (multipart/alternative).
 *
 * Aucune dépendance. Tout est échappé.
 */
function commande_mail(array $c): array
{
    $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $eur = fn (float $n) => number_format($n, 2, ',', ' ') . ' €';

    // Date de retrait en toutes lettres, sans dépendre de setlocale().
    $jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    $mois  = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    $ts    = strtotime((string) ($c['retrait'] ?? '')) ?: time();
    $date  = $jours[(int) date('w', $ts)] . ' ' . (int) date('j', $ts) . ' ' . $mois[(int) date('n', $ts)] . ' ' . date('Y', $ts);
    $creneau = (string) ($c['creneau'] ?? date('H:i', $ts));

    $numero   = (string) ($c['numero'] ?? '');
    $prenom   = trim((string) ($c['prenom'] ?? ''));
    $contact  = (string) ($c['contact'] ?? 'corbais@atelierby.be');
    $boutique = (string) ($c['boutique'] ?? "L'Atelier By");
    $paye     = !empty($c['paye']);
    $total    = (float) ($c['total'] ?? 0);
    $font     = "'Gotham',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    /* ---- lignes de commande (facultatives) ---- */
    $lignesHtml = '';
    if (!empty($c['lignes']) && is_array($c['lignes'])) {
        $rows = '';
        foreach ($c['lignes'] as $l) {
            $qte  = (int) ($l['qte'] ?? 1);
            $prix = (float) ($l['prix'] ?? 0);
            $rows .= '<tr>'
                . '<td style="padding:9px 0;border-bottom:1px solid #F0EBE3;font-size:14px;color:#232220;">' . $e($l['libelle'] ?? '') . '</td>'
                . '<td align="center" style="padding:9px 8px;border-bottom:1px solid #F0EBE3;font-size:13px;color:#8A847C;white-space:nowrap;">× ' . $qte . '</td>'
                . '<td align="right" style="padding:9px 0;border-bottom:1px solid #F0EBE3;font-size:14px;color:#232220;font-weight:600;white-space:nowrap;">' . $eur($prix * $qte) . '</td>'
                . '</tr>';
        }
        $th = 'font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#B8B2A8;font-weight:700;padding-bottom:6px;border-bottom:1px solid #E8E2D8;';
        $lignesHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;">'
            . '<tr><td style="' . $th . '">Article</td><td align="center" style="' . $th . '">Qté</td><td align="right" style="' . $th . '">Prix</td></tr>'
            . $rows . '</table>';
    }

    /* ---- bouton (facultatif) ---- */
    $bouton = '';
    if (!empty($c['lien'])) {
        $bouton = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr><td align="center">'
            . '<a href="' . $e($c['lien']) . '" style="display:inline-block;width:300px;max-width:92%;box-sizing:border-box;text-align:center;background:#8D1D2C;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 18px;border-radius:999px;font-family:' . $font . ';">Voir ma commande</a>'
            . '</td></tr></table>';
    }

    /* ---- pastille de paiement ---- */
    $pastille = $paye
        ? '<span style="display:inline-block;background:#E7F2EA;color:#1A6629;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:600;">&#10003; Payée en ligne</span>'
        : '<span style="display:inline-block;background:#FBF6EC;color:#8A6215;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:600;">À régler au retrait</span>';

    /* ---- contenu ---- */
    $contenu = '<p style="margin:0 0 14px;">Bonjour' . ($prenom !== '' ? ' ' . $e($prenom) : '') . ',</p>'
        . '<p style="margin:0 0 18px;">Votre commande est confirmée. Merci&nbsp;! Voici le récapitulatif&nbsp;:</p>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F6F1;border-radius:12px;">'
        . '<tr><td style="padding:18px 20px 6px;">'
        . '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8A847C;font-weight:700;">Commande</div>'
        . '<div style="font-size:20px;font-weight:700;color:#8D1D2C;letter-spacing:-.01em;margin-top:2px;font-family:' . $font . ';">' . $e($numero) . '</div>'
        . '</td></tr>'
        . '<tr><td style="padding:6px 20px 18px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#232220;">'
        . '<tr><td style="padding:6px 0;color:#8A847C;width:120px;vertical-align:top;">Retrait</td><td style="padding:6px 0;font-weight:600;">' . $e($date) . ' · ' . $e($creneau) . '</td></tr>'
        . '<tr><td style="padding:6px 0;color:#8A847C;vertical-align:top;">Boutique</td><td style="padding:6px 0;font-weight:600;">' . $e($boutique)
        . (!empty($c['adresse']) ? '<br><span style="font-weight:400;color:#8A847C;">' . $e($c['adresse']) . '</span>' : '') . '</td></tr>'
        . '<tr><td style="padding:6px 0;color:#8A847C;">Total</td><td style="padding:6px 0;font-weight:700;font-size:16px;">' . $eur($total) . '</td></tr>'
        . '<tr><td style="padding:6px 0;color:#8A847C;">Paiement</td><td style="padding:6px 0;">' . $pastille . '</td></tr>'
        . '</table>'
        . '</td></tr></table>'
        . $lignesHtml
        . (!empty($c['note']) ? '<p style="margin:14px 0 0;font-size:13px;color:#8A847C;"><strong style="color:#232220;">Votre remarque&nbsp;:</strong> ' . $e($c['note']) . '</p>' : '')
        . $bouton
        . '<p style="margin:18px 0 0;">Présentez simplement ce numéro de commande au comptoir. À très vite&nbsp;!</p>';

    $logo = $e($c['logo'] ?? '');
    $titre = $e($numero);
    $bout = $e($boutique);
    $cont = $e($contact);

    /* ---- mise en page : la même que les e-mails du CRM ---- */
    $html = <<<HTML
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Confirmation de commande {$titre}</title></head>
<body style="margin:0;padding:0;background:#F4EFE8;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE8;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border-top:4px solid #8D1D2C;font-family:{$font};">
    <tr><td style="padding:28px 32px 8px;">
      <img src="{$logo}" alt="L'Atelier By" width="150" style="display:block;border:0;height:auto;max-width:150px;">
    </td></tr>
    <tr><td style="padding:14px 32px 28px;color:#232220;font-size:15px;line-height:1.6;">
      {$contenu}
    </td></tr>
    <tr><td style="padding:18px 32px;background:#F9F6F1;border-top:1px solid #ececec;color:#8A847C;font-size:12px;line-height:1.5;">
      <strong style="color:#232220;">{$bout}</strong> — Sucré · Salé · À emporter<br>
      <a href="mailto:{$cont}" style="color:#8D1D2C;text-decoration:none;">{$cont}</a>
    </td></tr>
  </table>
  <div style="color:#B8B2A8;font-size:11px;padding:14px 0;font-family:{$font};">Cet e-mail vous est adressé par L'Atelier By suite à votre commande en ligne.</div>
</td></tr>
</table>
</body></html>
HTML;

    /* ---- version texte (multipart/alternative, anti-spam) ---- */
    $text = "Bonjour" . ($prenom !== '' ? " $prenom" : '') . ",\n\n"
        . "Votre commande est confirmée.\n\n"
        . "$numero\n"
        . "Retrait : $date · $creneau\n"
        . "Boutique : $boutique" . (!empty($c['adresse']) ? " — {$c['adresse']}" : '') . "\n"
        . "Total : " . $eur($total) . "\n"
        . ($paye ? "Commande payée en ligne.\n" : "À régler au retrait.\n")
        . (!empty($c['lien']) ? "\nVoir ma commande : {$c['lien']}\n" : '')
        . "\nMerci pour votre commande.\n$boutique — $contact\n";

    return ["Confirmation de commande $numero", $html, $text];
}

/* Aperçu dans le navigateur : php -S 127.0.0.1:8080 commande_mail.php  puis  http://127.0.0.1:8080/?apercu=1 */
if (PHP_SAPI !== 'cli' && isset($_GET['apercu']) && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    [, $html] = commande_mail([
        'numero' => 'WEB-2-20260916-47B8C4', 'prenom' => 'Sophie', 'retrait' => '2026-09-16 14:00:00', 'creneau' => '14:00–15:00',
        'boutique' => "L'Atelier By — Corbais", 'adresse' => 'Rue de la Gare 12, 1435 Corbais',
        'lignes' => [['libelle' => 'Tarte au sucre', 'qte' => 1, 'prix' => 2.00]], 'total' => 2.00, 'paye' => true,
        'lien' => 'https://www.atelierby.be/commande/WEB-2-20260916-47B8C4', 'contact' => 'corbais@atelierby.be', 'logo' => 'https://www.atelierby.be/crm/img/logo.png',
    ]);
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
}
