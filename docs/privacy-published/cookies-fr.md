# Politique cookies et technologies similaires

Version : 2026-10-28.

## 1. Champ

Les cookies et technologies similaires incluent sessionStorage, localStorage et cache PWA. La finalité et la stricte nécessité déterminent le consentement. Les mécanismes strictement nécessaires à une fonction expressément demandée sont exemptés, avec information ci-dessous. Toute préférence pratique n’est pas automatiquement nécessaire.

## 2. Votre choix

ASIMA définit les règles du compte commun et de la mesure ; le vendeur choisi répond de la commande. Contact : webshop@atelierby.be. Google Analytics facultatif nécessite une configuration active et votre accord. Quand la mesure est désactivée, les paramètres l’indiquent sans solliciter un accord pour une activation future. Quand elle est active, vous pouvez refuser, choisir les paramètres ou accepter l’analyse. Fermer ou continuer à naviguer n’est pas consentir. Le choix vaut six mois calendaires, sauf changement de version nécessitant une nouvelle décision.

## 3. Mécanismes et durées

| Mécanisme | Finalité | Durée et nettoyage |
| --- | --- | --- |
| localStorage ws.consent | Choix, version et dates | Validité six mois ; contrôle et suppression du choix périmé par l’application. |
| sessionStorage ws.session.v1: — jetons, profil, préférences | Connexion, langue, magasin, livraison, onglet du compte | Session d’onglet, au plus 12 heures après chaque écriture. Rotation du jeton : nouvelle écriture. Profil et livraison effacés à la déconnexion. |
| Indicateurs d’installation PWA en session | Installation et report du message | Jusqu’à 12 heures après écriture, dans la session. |
| sessionStorage ws.order.token.*, ws.pendingPay, ws.lastPay, ws_handoff_clean | Accès commande, reprise du paiement et passage de contexte | Session d’onglet ; nettoyage complémentaire après certaines opérations et déconnexion. |
| Cache PWA / service worker | Ressources publiques, mises à jour, hors ligne | HTML de navigation : au plus deux entrées, limite 12 heures appliquée pendant les opérations cache. Précache versionné, nettoyé aux mises à jour. API et navigations paramétrées exclues de cette règle. |
| Stripe et son interface | Paiement demandé par le client | Enregistrements et durées selon fonction/configuration Stripe ; voir [Stripe](https://stripe.com/privacy). Les données transactionnelles ne valent pas accord Google Analytics. |

## 4. Google Analytics

Avec service actif et accord, Google Analytics peut utiliser _ga et _ga_<identifiant>. Le module limite les cookies à 180 jours au maximum et au temps de consentement restant, sans prolongation à chaque visite. sessionStorage ws.ga4.purchase.* limite les achats envoyés plusieurs fois et est nettoyé au retrait. Le stockage réel dépend du navigateur et prestataire. Google peut recevoir identifiants et contexte technique ; l’anonymat n’est pas garanti.

## 5. Retrait

Dans « Paramètres des cookies », vous pouvez changer ou retirer votre accord. Le refus et le retrait ne bloquent ni commandes ni paiements. Le module arrête ses événements et nettoie les enregistrements facultatifs reconnus et accessibles, tout en conservant connexion et paiement. Il ne peut supprimer ainsi les données d’autres domaines, HttpOnly, chemins invisibles ou déjà envoyées. Si l’arrêt est incomplet, un message demande une actualisation après l’achat.

## 6. Navigateur et modifications

Le navigateur peut restaurer ou copier une session dans un nouvel onglet. Les limites sont contrôlées à la lecture, au démarrage et au retour sur la page ; l’application ne peut effacer des données quand le navigateur est fermé. En cas de stockage bloqué, seule la mémoire de la page est utilisée. Effacer les données du site peut déconnecter et supprimer préférences/reprise du paiement, sans supprimer les commandes serveur. Les anciens enregistrements persistants connus sont nettoyés sans migration du profil.
