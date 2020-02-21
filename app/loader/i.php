<?php

require '../vendor/autoload.php';
require './db.class.php';

use GuzzleHttp\Pool;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;
use Cocur\Slugify\Slugify;

// setting request options. Headers and proxy
$requestOptions = setRequestOptions($proxy = false);
$client = new Client($requestOptions);

$db = new Db;
$slugify = new Slugify(); // will be used to generate slug for each item

$uriList = file('./source_lists/list.txt', FILE_IGNORE_NEW_LINES); // list of urls for scraping

// loading multithreading Guzzle with urls
$requests = function () use ($uriList) {
    foreach ($uriList as $listItem) {
    	yield new Request('GET', $listItem);	
    }
};

// fetching and scraping data
$pool = new Pool($client, $requests(), [
    'concurrency' => 1,
    'fulfilled' => function ($response, $index) use ($uriList, $db, $slugify) {

    	$html = (string)$response->getBody();
    	$doc = hQuery::fromHTML($html);

    	// app name

    	$h1 = $doc->find('h1');

    	if (!$h1)
    		return;

    	$item['name'] = (string)$h1;

    	// slug

		$item['slug'] = $slugify->slugify($item['name']); 

    	// image

    	$image = $doc->find('.img-fluid');

    	if (!$image)
    		$item['image'] = null;
    	else
    		$item['image'] = $image->attr('src');

    	// app website 

    	preg_match('#<p class="mb-2">(htt.+?)</p>#', $html, $ok);

    	if (isset($ok[1]))
    		$item['website'] = $ok[1];
    	else
    		$item['website'] = null;

    	// reviews

    	$reviewsHtml = $doc->find('.i18n-translation_container'); // block containing review text & rating

    	$namesList = file('./names/names.txt', FILE_IGNORE_NEW_LINES); 
    	$lastNames = file('./names/last_names.txt', FILE_IGNORE_NEW_LINES);

    	foreach ($reviewsHtml as $key => $value) {

    		$item['reviews'][$key]['avatar'] = generateAvatar();
            // postponed date
    		$postAfterDays = rand(1,100);
			$item['reviews'][$key]['date'] = date("Y-m-d H:i:s", strtotime('+ '.$postAfterDays.' days'));
			$item['reviews'][$key]['author'] = $namesList[array_rand($namesList)];
            // adding last name randomly
    		if (rand(1,2)==2)
        		$item['reviews'][$key]['author'] .= ' '.ucfirst($lastNames[array_rand($lastNames)]);

    		// rating

    		$r = $value -> find('.h1');

    		if (!$r)
    			$item['reviews'][$key]['rating'] = 0;
    		else {
	    		$r = preg_replace('#/.+#', '', $r);
	    		$item['reviews'][$key]['rating'] = $r;
	    	}

    		// reviews

    		$r = $value->find('div');

    		if (!$r)
	    		return;

	    	foreach ($r as $rr) { 

	    		if ($rr->attr('class') !== "col-12 mt-3") // block with review text
	    			continue;

	    		$p = $rr -> find('p');

	    		if ($p == null)
	    			continue;

	    		foreach ($p as $pp) {

	    			preg_match('#<strong>(.+?): </strong>(.+)#s', (string)$pp, $ok);

	    			if (isset($ok[1])) {
	    				if (isset($item['reviews'][$key]['text']))
			    			$item['reviews'][$key]['text'] .= $ok[1] . ': ' . trim($ok[2]) . '<br><br>' . "\n\n";
			    		else
	    					$item['reviews'][$key]['text'] = $ok[1] . ': ' . trim($ok[2]) . '<br><br>' . "\n\n";
	    			}
	    		}
	    	}
    	}
 		
    	$id = $db->addItem($item); 
    	$db->addComments($item['reviews'], $id);

    	echo '.'; // end of iteration

    },
    'rejected' => function ($reason, $index) {
        // this is delivered each failed request
    },
]);

// Initiate the transfers and create a promise
$promise = $pool->promise();

// Force the pool of requests to complete.
$promise->wait();

// ====================

// Generates avatar.
// Returns default image 'user.png' or image from thispersondoesnotexist.com in a random number of cases
function generateAvatar(){

	$user_avatar = 'user.png';

	if (rand(1,3)==3) {
		$img_folder = '../public/img/users/';

		$image = chunk_split(base64_encode(file_get_contents('https://thispersondoesnotexist.com/image')));
		$imgdata = base64_decode($image);
		$f = finfo_open();
	    $mime_type = finfo_buffer($f, $imgdata, FILEINFO_MIME_TYPE);
	    $type_file = explode('/', $mime_type);
	    $avatar = time() . '.' . $type_file[1];

	    $file_name = substr(md5($imgdata), 0, 15).'.jpg';

	    if (!file_exists($img_folder.$file_name))
	    {
		    file_put_contents($img_folder.$avatar,$imgdata);

		    resizeImage($img_folder.$avatar, $img_folder.$file_name, 146, 146);
		    unlink($img_folder.$avatar);

		    $user_avatar = $file_name;
		}
	}

	return $user_avatar;
}

/**
 * Resize image - preserve ratio of width and height.
 * resizeImage('image.jpg', 'resized.jpg', 200, 200);
 */
function resizeImage($sourceImage, $targetImage, $maxWidth, $maxHeight, $quality = 80)
{
    // Obtain image from given source file.
    if (!$image = @imagecreatefromjpeg($sourceImage))
    {
        return false;
    }

    // Get dimensions of source image.
    list($origWidth, $origHeight) = getimagesize($sourceImage);

    if ($maxWidth == 0)
    {
        $maxWidth  = $origWidth;
    }

    if ($maxHeight == 0)
    {
        $maxHeight = $origHeight;
    }

    // Calculate ratio of desired maximum sizes and original sizes.
    $widthRatio = $maxWidth / $origWidth;
    $heightRatio = $maxHeight / $origHeight;

    // Ratio used for calculating new image dimensions.
    $ratio = min($widthRatio, $heightRatio);

    // Calculate new image dimensions.
    $newWidth  = (int)$origWidth  * $ratio;
    $newHeight = (int)$origHeight * $ratio;

    // Create final image with new dimensions.
    $newImage = imagecreatetruecolor($newWidth, $newHeight);
    imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
    imagejpeg($newImage, $targetImage, $quality);

    // Free up the memory.
    imagedestroy($image);
    imagedestroy($newImage);

    return true;
}

function cleanName($str) {
	$str = preg_replace('/[^a-zA-Z0-9\s\- \&\.\,\(\)\:]/', ' ', $str);
	$str = preg_replace('/\s+/', ' ', $str);
	return trim($str);
}


function setRequestOptions($useProxy = false) {

	if ($useProxy) {
		$proxyList = file_get_contents('http://proxyrack.net/rotating/megaproxy/');  
		$proxyArray = explode("\n",trim($proxyList));
		$randomProxy = array_rand(array_flip($proxyArray));
	}

	$chromeVersions = ['44.0.2403.157','60.0.3112.101','62.0.3202.94','51.0.2704.106','64.0.3282.39','68.0.3440.84'];
	$randomChromeVersion = $chromeVersions[rand(0, count($chromeVersions)-1)];

	$requestOptions = [
	    'cookies' => new \GuzzleHttp\Cookie\FileCookieJar('./guzzleCookes.txt', true),
	    //'proxy' => 'http://dmitry111:qweasdzxc@'.$randomProxy, //.@str_replace(':5055', ':4045', $randomProxy),
	    'headers' => [
	      'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' . $randomChromeVersion . ' Safari/537.36', 
	      'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	      'Accept-Language' => 'en-us,en;q=0.5',
	      'Accept-Charset' => 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
	      'Accept-Encoding' => 'gzip,deflate',
	      'Keep-Alive' => '115',
	      'Connection' => 'keep-alive',
	    ]
	];

	if ($useProxy)
		$requestOptions['proxy'] = 'http://'.$randomProxy;

	return $requestOptions;
}

function cleanDescription($s) {
	//return $s;
	$s = preg_replace('#<blockquote>.+?</blockquote>#s', '', $s);
	$s = preg_replace('#<a.+?http.+?answers.microsoft.com/.+?/profile/.+?>(.+?)</a>#s', "$1", $s);
	$s = str_replace("&nbsp;", ' ', $s);
	$s = str_replace(['<li>','</li>'], ['- ','<br>'], $s);
	//$s = str_replace('<li>', ' - ', $s);
	//$s = str_replace('</li>', '<br>', $s);
	$s = preg_replace('#<[\s/]+div>#', '', $s);
	$s = strip_tags($s, '<p><br><img><a><table><tbody><tr><td><th><strong><b>');
	$s = preg_replace('#<[a-z0-9\s]+>[\s]+</[a-z0-9\s]+>#', '', $s);
	return $s;
}
