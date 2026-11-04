<?php
namespace App\Api\Services\Auth {
    final class ClientActivationService {}
    final class ClientAuthService {
        private function issue(int $id): array {
            $token=bin2hex(random_bytes(24));
            file_put_contents(getenv('TFB_BROWSER_SESSION_FIXTURE_FILE'),json_encode(['token'=>$token,'id'=>$id]));
            return ['status'=>200,'data'=>['access_token'=>'fixture-access-'.$id,'refresh_token'=>$token,'expires_in'=>1800]];
        }
        public function authenticate(array $data): array { return $this->issue(($data['login']??'')==='b@example.test'?2:1); }
        public function refresh(array $data): array {
            $state=json_decode(@file_get_contents(getenv('TFB_BROWSER_SESSION_FIXTURE_FILE'))?:'{}',true);
            return isset($state['token'])&&hash_equals($state['token'],(string)($data['refresh_token']??''))?$this->issue($state['id']):['status'=>401,'errors'=>'Invalid refresh token'];
        }
        public function logout(array $data): array {
            $state=json_decode(@file_get_contents(getenv('TFB_BROWSER_SESSION_FIXTURE_FILE'))?:'{}',true);
            if (($state['token']??null)===($data['refresh_token']??null)) file_put_contents(getenv('TFB_BROWSER_SESSION_FIXTURE_FILE'),'{}');
            return ['status'=>200,'data'=>['ok'=>true]];
        }
        public function profile(): array {
            $auth=$_SERVER['HTTP_AUTHORIZATION']??'';
            return preg_match('/^Bearer fixture-access-([12])$/',$auth,$m)?['status'=>200,'data'=>['user'=>['id'=>(int)$m[1]]]]:['status'=>401,'errors'=>'Invalid token'];
        }
    }
}
namespace {
    if (!getenv('TFB_BROWSER_SESSION_FIXTURE_FILE')) { http_response_code(403); exit; }
    $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
    if (in_array($path,['/session-storage.js','/auth.js','/shop.js'],true)) {
        header('Content-Type: application/javascript');
        readfile(dirname(__DIR__, 3).'/WebShop/'.['/session-storage.js'=>'public/session-storage.js','/auth.js'=>'webshop-auth-api.jsx','/shop.js'=>'webshop-shop-router.jsx'][$path]);exit;
    }
    if (!str_starts_with($path,'/api/')) {
        header('Content-Type: text/html');echo '<script src="/session-storage.js"></script><script src="/auth.js"></script><script src="/shop.js"></script><script>WSAuth.endpoint="/api/v1/clients/auth"</script>';exit;
    }
    require dirname(__DIR__, 3).'/api/vendor/autoload.php';
    require dirname(__DIR__, 3).'/api/core/ResponseHandler.php';
    require dirname(__DIR__, 3).'/api/app/Services/Auth/ClientBrowserSession.php';
    require dirname(__DIR__, 3).'/api/app/Controllers/Auth/ClientAuthController.php';
    $controller=new \App\Api\Controllers\Auth\ClientAuthController(new \App\Api\Services\Auth\ClientAuthService(),new \App\Api\Services\Auth\ClientActivationService());
    $action=basename($path);$method=['login'=>'auth','refresh'=>'refresh','logout'=>'logout','me'=>'profile'][$action]??null;
    if ($method) $controller->$method();
    http_response_code(404);
}
