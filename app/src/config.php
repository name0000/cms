<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ENV','prod');

define('LOCALE', 'en');

define('DB_NAME','capterra');
define('DB_USER','root');
define('DB_PASS','Ce_>!YflH4>:');
define('DB_CHARSET','utf8mb4'); 
define('DB_PORT', 3306); 
define('DB_HOST', 'localhost'); 

define('TWIG_VIEWS_FOLDER', __DIR__.'/views');
define('TWIG_CACHE_FOLDER', __DIR__.'/../cache');
define('TWIG_AUTO_RELOAD', true); // disable cache
define('TWIG_AUTOESCAPE', false);

define('STATIC_PAGES_CONTENT_FOLDER', __DIR__.'/pages');
define('BLOG_PAGES_FOLDER', __DIR__.'/blog');


define('CATEGORY_ITEMS_PER_PAGE', 10);

define('MAX_COMMENTS_PER_PAGE', 200);
/*
	If false then there will be MAX_COMMENTS_PER_PAGE on page on ALL PAGES no matter other other conditions
*/
define('POSTPONED_COMMENT_PUBLISH', false); 
define('PUBLISH_ONE_COMMENT_EACH_DAYS', 3); 
/*	
	If POSTPONED_COMMENT_PUBLISH == true
	3 comments to be displayed even if ITEMS.date_created == 0 and calculated number of comments is also <3
	
	This does not touch those ITEMS that are published before FIRST_ITEM_DATE (i call them FIRST ITEMS). Those will have MINIMUM_COMMENTS_FIRST_ITEMS 
*/
define('MINIMUM_COMMENTS', 3);  
/*
	All ITEMS that are published before FIRST_ITEM_DATE will have MINIMUM_COMMENTS_FIRST_ITEMS from start.
	All the rest will have MINIMUM_COMMENTS if POSTPONED_COMMENT_PUBLISH == true and MAX_COMMENTS_PER_PAGE otherwise
*/
define('FIRST_ITEM_DATE', '2020-01-01'); 
// define('MINIMUM_COMMENTS_FIRST_ITEMS', 100);

define('RECAPTCHA_SITE_KEY', '6LewhYIUAAAAAMzftPMke5flKgnEgbQ-gN3ylkLN'); 
define('RECAPTCHA_SECRET', '6LewhYIUAAAAAJ-e9wkrWoxVrGRfh6iPNxQ9Bpe2'); 

if (PHP_SAPI == 'cli-server') {
    // To help the built-in PHP dev server, check if the request was actually for
    // something which should probably be served as a static file
    $url  = parse_url($_SERVER['REQUEST_URI']);
    $file = __DIR__ . $url['path'];
    if (is_file($file)) {
        return false;
    }
}

if (isset($_SERVER['REQUEST_URI']))
{
	global $url;
	$url = (isset($_GET['___url'])?$_GET['___url']:$_SERVER['REQUEST_URI']);
	$url = filter_var($url, FILTER_SANITIZE_URL);
}
//$route =  array_filter(explode('/', filter_var($url, FILTER_SANITIZE_URL)));
