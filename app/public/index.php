<?php


namespace App;

use \Dice\Dice;
use \Router;

if (!file_exists(__DIR__.'/../src/config.php'))
	die('No config file. Rename and edit /src/config-sample.php');

require_once __DIR__.'/../vendor/autoload.php';

// Dice = autowiring 
$dice 		= new Dice;
$controller = $dice->create('\App\Controller\Controller');
$app 	= $dice->create('\App\Helper\Helper');

/**
* Router
*/

Router::route('/', function() use($controller){

	$controller -> homePage();

});

// item page
Router::route('/([0-9]+)/([^/]+)', function($id, $artist_name) use($controller){

	$controller -> itemPage($id, $artist_name);

});

// postign comment for the item
Router::route('/feedbackpost', function() use($controller){

	$_POST  = filter_input_array(INPUT_POST, FILTER_SANITIZE_STRING);
	//print_r($_POST);

	$controller -> postFeedback($_POST);

	echo 'Thank you! Your feedback will be posted';

});

 
Router::route('/category/([0-9]+)(|/[0-9]+)', function($cat_id, $page) use($controller){

	if ($page != null)
		$page = str_replace('/', '', $page);

	$controller -> catPage($cat_id, $page);

});


// static pages
Router::route('/page/([-a-z0-9]+)', function($page_file) use($controller){

	$page = STATIC_PAGES_CONTENT_FOLDER.'/'.$page_file.'.txt';

	if (file_exists($page))
		$controller -> staticPage($page, $page_file);

});

// blog static pages
Router::route('/blog/([-A-Za-z0-9]+|)', function($page_file) use($controller, $app){
	
	if ($page_file == '')
	{
		$pages = $app -> getBlogPages();
		$page = BLOG_PAGES_FOLDER.'/'.$pages[0]['href'].'.php';
	}
	else
		$page = BLOG_PAGES_FOLDER.'/'.$page_file.'.php';

	if (file_exists($page))
		$controller -> blogPage($page, $page_file);

});

Router::route('/search\?q=(.+)', function($q) use($controller){

	// $_POST  = filter_input_array(INPUT_GET, FILTER_SANITIZE_STRING);
	// print_r($_POST);
	$q = urldecode($q);
	$q = trim($q);
	$q = filter_var($q, FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_HIGH);
	$controller -> search($q); 

	// $controller -> search($_POST['search']);

});

Router::route('/contact', function() use($controller){

	$_POST  = filter_input_array(INPUT_POST, FILTER_SANITIZE_STRING);
	$controller -> contactPage($_POST);	
		

});

// item gallery page. previous regex: ([a-fA-F0-9-]{36}
// Router::route('/gallery/([0-9]+)', function($artist_id) use($controller){

// 	$controller -> gallery($artist_id);
// 	//echo '<center><img src="http://photos-eu.bazaarvoice.com/photo/2/cGhvdG86dGlja2V0bWFzdGVy/'.$image_id.'"></center>';

// });


if (false === Router::execute($url)) 
{
	header("Location: /",true,301);
	exit;
}


if (ENV == 'dev')
	$app->devPanel();
else 
	$app->showExecutionTime();

