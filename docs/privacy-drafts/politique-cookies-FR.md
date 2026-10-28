# Politique relative aux cookies et technologies similaires — projet FR

PROJET À VÉRIFIER — NE PAS PUBLIER avant résolution de DEC-01 à DEC-12. Version draft-0.4, situation au 28.10.2026. La liste décrit le code local, pas une observation de la production. Les mentions DEC sont des instructions de révision.

## 1. Portée et responsabilité

Cette politique concerne https://webshop.atelierby.be. Le propriétaire du réseau est ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29, 50-078 Wrocław, Pologne. Contact : webshop@atelierby.be. [DEC-01/02 : identifier le ou les responsables pour les finalités concernées et le rôle du vendeur choisi]. Confidentialité : [DEC-12 : lien FR réel].

Les cookies sont de petits enregistrements du navigateur. Des règles similaires peuvent couvrir localStorage, sessionStorage, pixels et autres accès/écritures sur le terminal. Le webshop utilise aussi un cache PWA. La qualification dépend du but réel et de la nécessité, pas du nom de la technologie.

## 2. Catégories et choix

Les mécanismes strictement nécessaires servent la communication ou une fonction expressément demandée. L’exemption doit être examinée individuellement et ne supprime pas l’information. Une préférence persistante n’est pas automatiquement nécessaire (DEC-08).

La mesure facultative sert à comprendre l’utilisation du webshop. Google Analytics est actuellement désactivé ; Ads, Meta et GTM ne sont pas activés dans ce périmètre. Une activation future de GA4 nécessite information, configuration appropriée et consentement préalable. Ce n’est ni une garantie d’anonymat ni une condition des achats.

Les boutons permettent de refuser la mesure facultative, ouvrir les paramètres ou accepter l’analyse. Fermer la bannière ou continuer à naviguer ne vaut pas consentement. Commandes et paiements restent disponibles après refus. Vous pouvez modifier votre choix dans « Paramètres des cookies » ; refuser y retire l’accord. [DEC-12 : vérifier libellés et accessibilité dans le déploiement réel].

## 3. Mécanismes dans le code analysé

Sauf fournisseur externe indiqué, il s’agit d’enregistrements propres à l’application. Ne pas publier les catégories soumises à DEC-08 comme exemptées sans examen.

Les enregistrements fonctionnels ci-dessous utilisent le préfixe sessionStorage `ws.session.v1:`. La limite de 12 heures part de chaque écriture ; la lecture ne la prolonge pas. Contrôle à la lecture, au démarrage et au retour sur la page. La restauration d’onglets peut conserver la session ; un onglet ouvert par un autre peut en recevoir une copie. Aucune suppression physique n’est garantie lorsque le navigateur est fermé. Si le stockage est bloqué, seule la mémoire de la page est utilisée. Les anciens enregistrements localStorage connus sont supprimés sans migration ; une nouvelle connexion est nécessaire. Des onglets indépendants ou fenêtres PWA peuvent nécessiter une connexion séparée. Cette limitation technique ne décide pas de l’exemption de consentement (DEC-08).

| Mécanisme | But et déclenchement | Durée / qualification |
| --- | --- | --- |
| localStorage ws.consent | Choix explicite, version et dates | Choix valable 6 mois calendaires, contrôlé au démarrage/changement d’état ; pas de TTL natif localStorage. Nettoyage du choix périmé après connaissance de la version API ; préférence de consentement |
| sessionStorage ws_auth_token, ws_auth_refresh_token | Connexion et renouvellement | Session d’onglet, au plus 12 heures après chaque écriture ; la rotation est une nouvelle écriture. API : accès 30 min, renouvellement 90 jours renouvelés à la rotation. Déconnexion : suppression locale. DEC-08 |
| sessionStorage ws.customer | Profil local et préférences de compte | Session d’onglet, au plus 12 heures après écriture ; déconnexion/invalidité de session : suppression du profil. Étendue et nécessité : DEC-08 |
| sessionStorage ws.lang, ws.activeShop, `ws.deliveryPreference:<client>:<shop>`, ws.accountTab | Langue, magasin, livraison et onglet après utilisation | Session d’onglet, au plus 12 heures après écriture. Livraison et onglet du compte également effacés à la déconnexion. Nécessité/durée : DEC-08 |
| sessionStorage ws.pwa.install.laterAt, ws.pwa.install.installed | Report du message ou installation mémorisée | Session d’onglet, au plus 12 heures après écriture ; report jusqu’à 12 heures. Le mode installé est aussi détecté par le navigateur. DEC-08 |
| sessionStorage `ws.order.token.<ref>`, ws.pendingPay, ws.lastPay | Accès à la commande et reprise du paiement | Session d’onglet, sous réserve de restauration par le navigateur ; nettoyage partiel après paiement/déconnexion. Transaction, pas analyse ; DEC-08 |
| sessionStorage ws_handoff_clean | Protection technique du passage de contexte | Session d’onglet et suppression à la sortie du mode ; DEC-08 |
| Cache PWA / service worker | Ressources, page sans paramètres, mises à jour/hors ligne | HTML de navigation : au plus 2 entrées, limite de 12 heures appliquée pendant les opérations Workbox. Ressources publiques précachées versionnées et nettoyées aux mises à jour. Ni API ni navigation paramétrée. DEC-08/12 |
| Stripe et son interface de paiement | Après ouverture du paiement choisi | Noms, durées, destinataires et nécessité par fonction à vérifier dans DEC-05/08/12. Ne pas exempter automatiquement tout Stripe/Link |

## 4. GA4 prévu — actuellement inactif

| Mécanisme | But | Durée et condition |
| --- | --- | --- |
| _ga et `_ga_<identifiant>` | Distinguer navigateurs/sessions et mesurer des événements ; Google, entité à préciser DEC-05/07 | Après accord, configuration active et ID valide. Le code limite à 180 jours maximum et au temps restant du consentement, sans renouvellement à chaque visite. Vérifier le comportement réel |
| sessionStorage ws.ga4.purchase.* | Limiter les achats envoyés plusieurs fois | Après envoi consenti ; session d’onglet, nettoyage au retrait. La mémoire supplémentaire de page disparaît à sa fermeture |

Événements prévus : page_view, view_item, add_to_cart, begin_checkout, purchase. Produits, quantités, EUR et référence de transaction sont concernés, pas les champs de contact ou remarques. Google peut traiter des identifiants et données techniques de connexion. Sa conservation est distincte de la durée des cookies (DEC-07) ; un consentement de six mois ne supprime pas toutes les données après six mois.

## 5. Retrait, nettoyage et navigateur

Le retrait bloque les événements ultérieurs du module, désactive la mesure de la propriété et efface les cookies propriétaires visibles/reconnus ainsi que les marqueurs facultatifs GA4. Il préserve connexion, commande et paiement. Si l’arrêt échoue, une demande de rechargement est affichée ; aucune commande en cours n’est rechargée automatiquement.

Cela ne permet pas d’effacer les cookies d’autres domaines, HttpOnly, cachés sous d’autres chemins, ni d’annuler les données déjà envoyées. [DEC-05/07/12 : vérifier l’efficacité avec les vrais services]. Le navigateur permet aussi suppression ou limitation des données du site. Tout effacer peut déconnecter, supprimer préférences et informations de reprise ; cela n’efface pas les commandes du serveur. Les réglages du navigateur ne remplacent pas le consentement requis.

## 6. Autres pages, anciens enregistrements et changements

La liste de nettoyage comprend aussi _gid, _gat*, _gcl_*, _fbp et _fbc : elle ne prouve pas leur création actuelle. Landing B2B et pages legacy nécessitent DEC-12 ; les traceurs du landing modifié restent désactivés. Le choix la_lang du landing est maintenant limité à la session d’onglet et à 12 heures après écriture ; l’ancien localStorage est supprimé. Le déploiement du landing reste distinct (DEC-08/12). Les cookies d’infrastructure et prestataires actifs doivent être recensés sur le déploiement réel.

Une modification substantielle des finalités ou prestataires peut nécessiter un nouvel accord. Le changement de version invalide l’ancien choix dans le mécanisme préparé ; l’archivage des versions et des preuves relève de DEC-10. La politique de confidentialité complète les rôles, destinataires, transferts et droits.
