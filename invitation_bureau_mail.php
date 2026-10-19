<?php
/**
 * E-mail « Invitation à commander pour un bureau » — L'Atelier By webshop.
 * Même charte que les e-mails du CRM et que commande_mail.php : tableau 600 px,
 * liseré bordeaux, logo, pied de page, styles en ligne (Gmail, Outlook, Apple Mail).
 *
 * Usage :
 *   require 'invitation_bureau_mail.php';
 *   [$subject, $html, $text] = invitation_bureau_mail([
 *       'prenom'    => 'Sophie',                        // facultatif
 *       'bureau'    => 'Odoo (Sa)',
 *       'societe'   => 'Odoo (Sa)',
 *       'tva'       => 'BE0477472701',
 *       'invite_par'=> 'Marc Dupont',                   // facultatif : qui invite
 *       'lien'      => 'https://webshop.atelierby.be/office-invite.html?token=…',
 *       'validite'  => '7 jours',                       // facultatif : durée du lien
 *       'contact'   => 'corbais@atelierby.be',
 *       'logo'      => 'https://www.atelierby.be/crm/img/logo.png',   // URL ABSOLUE
 *   ]);
 *   // Envoi : $html en text/html, $text en text/plain (multipart/alternative).
 *
 * Aucune dépendance. Tout est échappé. Le jeton n'apparaît jamais en clair dans
 * le texte visible : seul le bouton (et une ligne de repli) porte le lien.
 */
function invitation_bureau_mail(array $c): array
{
    $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $prenom   = trim((string) ($c['prenom'] ?? ''));
    $bureau   = (string) ($c['bureau'] ?? '');
    $societe  = (string) ($c['societe'] ?? $bureau);
    $tva      = (string) ($c['tva'] ?? '');
    $invitePar = trim((string) ($c['invite_par'] ?? ''));
    $lien     = (string) ($c['lien'] ?? '');
    $validite = trim((string) ($c['validite'] ?? ''));
    $contact  = (string) ($c['contact'] ?? 'corbais@atelierby.be');
    $font     = "'Gotham',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    /* ---- bouton ---- */
    $bouton = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr><td align="center">'
        . '<a href="' . $e($lien) . '" style="display:inline-block;width:300px;max-width:92%;box-sizing:border-box;text-align:center;background:#8D1D2C;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 18px;border-radius:999px;font-family:' . $font . ';">Ouvrir le webshop</a>'
        . '</td></tr></table>';

    /* ---- les trois étapes, numérotées : c'est ce que le mail brut ne disait pas clairement ---- */
    $etape = fn (int $n, string $t) => '<tr><td style="padding:5px 10px 5px 0;vertical-align:top;width:26px;">'
        . '<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:999px;background:#8D1D2C;color:#ffffff;font-size:12px;font-weight:700;font-family:' . $font . ';">' . $n . '</span>'
        . '</td><td style="padding:5px 0;font-size:14px;color:#232220;line-height:1.5;">' . $t . '</td></tr>';

    /* ---- contenu ---- */
    $contenu = '<p style="margin:0 0 14px;">Bonjour' . ($prenom !== '' ? ' ' . $e($prenom) : '') . ',</p>'
        . '<p style="margin:0 0 18px;">' . ($invitePar !== '' ? '<strong>' . $e($invitePar) . '</strong> vous invite' : 'Vous êtes invité(e)') . ' à commander sur notre webshop dans le contexte de votre bureau. Vos commandes seront rattachées à la société ci-dessous.</p>'

        // Bloc récapitulatif : fond crème, deux colonnes.
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F6F1;border-radius:12px;">'
        . '<tr><td style="padding:18px 20px 6px;">'
        . '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8A847C;font-weight:700;">Bureau</div>'
        . '<div style="font-size:20px;font-weight:700;color:#8D1D2C;letter-spacing:-.01em;margin-top:2px;font-family:' . $font . ';">' . $e($bureau) . '</div>'
        . '</td></tr>'
        . '<tr><td style="padding:6px 20px 18px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#232220;">'
        . '<tr><td style="padding:6px 0;color:#8A847C;width:130px;">Société</td><td style="padding:6px 0;font-weight:600;">' . $e($societe) . '</td></tr>'
        . ($tva !== '' ? '<tr><td style="padding:6px 0;color:#8A847C;">Numéro de TVA</td><td style="padding:6px 0;font-weight:600;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;">' . $e($tva) . '</td></tr>' : '')
        . '</table>'
        . '</td></tr></table>'

        . '<p style="margin:20px 0 8px;font-weight:600;">Pour rejoindre ce bureau&nbsp;:</p>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">'
        . $etape(1, 'Ouvrez le webshop avec le bouton ci-dessous.')
        . $etape(2, 'Créez votre compte, ou connectez-vous si vous en avez déjà un.')
        . $etape(3, 'Le bureau s\'ajoute automatiquement à votre compte&nbsp;: vous pouvez commander.')
        . '</table>'
        . $bouton
        . '<p style="margin:14px 0 0;font-size:12px;color:#8A847C;line-height:1.5;">'
        . ($validite !== '' ? 'Ce lien d\'invitation est valable ' . $e($validite) . ' et vous est personnel. ' : 'Ce lien d\'invitation vous est personnel. ')
        . 'Si le bouton ne s\'ouvre pas, copiez cette adresse dans votre navigateur&nbsp;:<br>'
        . '<a href="' . $e($lien) . '" style="color:#8D1D2C;word-break:break-all;">' . $e($lien) . '</a></p>'
        . '<p style="margin:18px 0 0;">Une question&nbsp;? Répondez simplement à cet e-mail.</p>';

    $logo = $e($c['logo'] ?? '');
    $cont = $e($contact);
    $titre = $e($bureau);

    /* ---- mise en page : la même que les e-mails du CRM ---- */
    $html = <<<HTML
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Invitation à commander — {$titre}</title></head>
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
      <strong style="color:#232220;">L'Atelier By</strong> — Webshop · Sucré · Salé · À emporter<br>
      <a href="mailto:{$cont}" style="color:#8D1D2C;text-decoration:none;">{$cont}</a>
    </td></tr>
  </table>
  <div style="color:#B8B2A8;font-size:11px;padding:14px 0;font-family:{$font};">Vous recevez cet e-mail parce qu'un membre de ce bureau vous a invité(e). Si ce n'est pas attendu, ignorez-le&nbsp;: rien ne se passera.</div>
</td></tr>
</table>
</body></html>
HTML;

    /* ---- version texte (multipart/alternative, anti-spam) ---- */
    $text = "Bonjour" . ($prenom !== '' ? " $prenom" : '') . ",\n\n"
        . ($invitePar !== '' ? "$invitePar vous invite" : "Vous êtes invité(e)") . " à commander sur notre webshop dans le contexte de votre bureau.\n\n"
        . "Bureau : $bureau\n"
        . "Société : $societe\n"
        . ($tva !== '' ? "Numéro de TVA : $tva\n" : '')
        . "\nPour rejoindre ce bureau :\n"
        . "1. Ouvrez le webshop : $lien\n"
        . "2. Créez votre compte, ou connectez-vous.\n"
        . "3. Le bureau s'ajoute à votre compte : vous pouvez commander.\n"
        . ($validite !== '' ? "\nCe lien est valable $validite et vous est personnel.\n" : "\nCe lien vous est personnel.\n")
        . "\nL'Atelier By — $contact\n";

    return ["Invitation à commander pour le bureau $bureau", $html, $text];
}

/* Aperçu dans le navigateur : php -S 127.0.0.1:8080 invitation_bureau_mail.php  puis  http://127.0.0.1:8080/?apercu=1 */
if (PHP_SAPI !== 'cli' && isset($_GET['apercu']) && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    [, $html] = invitation_bureau_mail([
        'prenom' => 'Sophie', 'bureau' => 'Odoo (Sa)', 'societe' => 'Odoo (Sa)', 'tva' => 'BE0477472701', 'invite_par' => 'Marc Dupont',
        'lien' => 'https://webshop.atelierby.be/office-invite.html?token=VtO6YmAamH08sodQnmrhgoPVTaszKdoufPjZUgixjs', 'validite' => '7 jours',
        'contact' => 'corbais@atelierby.be', 'logo' => 'https://www.atelierby.be/crm/img/logo.png',
    ]);
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
}
