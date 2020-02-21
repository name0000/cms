<?php

namespace App\Controller;

use \App\Model\Model;
use \App\Helper\Helper;

class Controller
{	

	public $db;
	public $app;
	public $twig;

	public function __construct(Model $db, Helper $app) 
	{
		$this -> db = $db; 
		$this -> app = $app;
		$this -> twig = $app -> loadTwig();

		$locale = LOCALE;
		// if(isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) && strlen($_SERVER['HTTP_ACCEPT_LANGUAGE'])>0) {
		//   $locale = substr($_SERVER['HTTP_ACCEPT_LANGUAGE'], 0, 2);
		// }

	    $translator = new \Symfony\Component\Translation\Translator($locale, new \Symfony\Component\Translation\MessageSelector());
		$translator->setFallbackLocales(['en']);
		$translator->addLoader('yaml', new \Symfony\Component\Translation\Loader\YamlFileLoader());
		$translator->addResource('yaml',  __DIR__.'/locales/en.yml', 'en');
		$translator->addResource('yaml',  __DIR__.'/locales/fr.yml', 'fr');

		$this -> twig -> addExtension(new \Symfony\Bridge\Twig\Extension\TranslationExtension($translator));

	}

	public function contactPage($a = array())
	{	

		if (is_array($a) == false or count($a) == 0)
		{
			$this->twig->display('contact_us_page.twig', array('recaptcha_site_key' => RECAPTCHA_SITE_KEY));
			return;
		}
		
		if (!isset($a["g-recaptcha-response"]) or strlen($a["g-recaptcha-response"])<50)
			die();

		$postdata = http_build_query(
            array(
                'secret' => RECAPTCHA_SECRET,
                'response' => $a["g-recaptcha-response"]
            )
        );

        $opts = array('http' =>
            array(
                'method'  => 'POST',
                'header'  => 'Content-type: application/x-www-form-urlencoded',
                'content' => $postdata
            )
        );

        $context  = stream_context_create($opts);

        $result = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);

        $check = json_decode($result);

        if($check->success) {

        	unset($a['g-recaptcha-response']);
            
            $data = implode("\n", $a);

			file_put_contents('./contact-messages.txt',"\n\n========".date('Y-m-d')."=========\n\n" . $data, FILE_APPEND);

			echo 'Thank you! Your message is sent';

        } else {
            die("Captcha Error");
        }

		return;
	}


	public function postFeedback($a)
	{	

		if (!isset($a["g-recaptcha-response"]) or strlen($a["g-recaptcha-response"])<50)
			die ('');

		$a['feedback_rate'] = 1;
		$a['feedback_rate'] = @str_replace('rating-input-1-', '', $a['feedback_rate']);

		$postdata = http_build_query(
            array(
                'secret' => RECAPTCHA_SECRET,
                'response' => $a["g-recaptcha-response"]
            )
        );

        $opts = array('http' =>
            array(
                'method'  => 'POST',
                'header'  => 'Content-type: application/x-www-form-urlencoded',
                'content' => $postdata
            )
        );

        $context  = stream_context_create($opts);

        $result = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);

        $check = json_decode($result);

        if($check->success) {
            $this->db->postFeedback($a);

        } else {
            die("Captcha Error");
        }

		return;
	}

	// 2DO : add pagination

	public function search($s)
	{
		$item = $this -> db -> search($s);

		$this->twig->display('search.html.twig', array('content' => $item, 'search_phrase' => $s ));

		return;
	}

	public function staticPage($page_file, $title)
	{
		$item = file_get_contents($page_file);

		$this->twig->display('static_page.html.twig', array('content' => $item, 'title' => $title));

		return;
	}

	public function blogPage($page_file, $title)
	{

		$blog_links = $this -> app -> getBlogPages();

		$item = file_get_contents($page_file);

		$this->twig->display('blog_page.html.twig', array('content' => $item, 'title' => $title, 'links' => $blog_links));

		return;
	}

	public function homePage()
	{		 

		$fname = './cache.homepage.json'; 
		
		if (!file_exists($fname))
		{	$model = $this -> db -> homePage();
			file_put_contents($fname,json_encode($model));	
		} else {
			$f = file_get_contents($fname);
			$model = json_decode($f,1);
		}

		$model = $this -> db -> homePage();

		shuffle($model['items']);

		$model['footer_links'] = array_slice($model['items'], 51, 100);
		$model['items'] = array_slice($model['items'], 0, 25);

		$blog_links = $this -> app -> getBlogPages();

		$this->twig->display('home.html.twig', 
			[
				'comments' => $model['comments'], 
				'items' => $model['items'], 
				'footer_links' => $model['footer_links'],
				'blog_links' => $blog_links
			]);
		
		return;
	}

	public function itemPage($id, $slug)
	{	

		$item = $this -> db -> itemPage($id);

		// print_r($item); die;

		if (isset($item['cats']) and !is_array($item['cats']))
			$item['cats'] = array($item['cats']);

		if (isset($item['cats_id']) and !is_array($item['cats_id']))
			$item['cats_id'] = array($item['cats_id']);


		// rates 

		$rates = ['1'=>0, '2'=>0, '3'=>0, '4'=>0, '5'=>0];
		$total_rates = 0;
		$av = 0;

		if (isset($item['comments']) and count($item['comments'])>0)
		{	
			$sum = 0;

			foreach ($item['comments'] as $key => $value) {
				if ($value['rating'] !== null)
				{
					$rates[$value['rating']]++; // eg: $rates[5]++

					if ($value['rating']>0)
						$total_rates++;

					$sum += $value['rating'];
				}
			}

			if ($total_rates > 0)
				$av = floor($sum/$total_rates);

		}

		// links to items that are next to each other by ID in db

		if (isset($item['neighbors']) and count($item['neighbors'])>0)
		{
			foreach ($item['neighbors'] as $key => $value) {

				if ($key == 0 or $key == 4) 
					$item['neighbors'][$key]['name'] = $value['name']; 
			}
		}

		// blog 

		$blog_links = $this -> app -> getBlogPages();
		$blog_links = array_slice($blog_links, -4);
		
		$this->twig->display('item.html.twig', 
			[
				'item' => $item, 
				'rates' => $rates, 
				'average_rate' => $av, 
				'total_rates' => $total_rates, 
				'recaptcha_site_key' => RECAPTCHA_SITE_KEY, 
				'recaptcha_secret' => RECAPTCHA_SECRET, 
				'blog_links' => $blog_links
			]);
		
		return;
	}

	public function catPage($id, $page)
	{	
		if ($page == null)
			$page = 0;

		$model = $this -> db -> catPage($id, $page);

		$item = $model['sql_res'];

		//print_r($item);

		if (count($item)<1) {
			$this->app->show404();
			return;
		}

		/*echo '<pre>';
		print_r($item);
		echo '</pre>';
		die;*/

		// first 'next' page starts with #2 
		if ($page == 0)
			$page = 1;

		foreach ($item as $key => $value) {

			$item[$key]['original_name'] = $item[$key]['name'];
			$str = $item[$key]['name'];

			$tmp = explode(',', $item[$key]['name']);
			$tmp = array_reverse($tmp);

			if (count($tmp)>0)
			{
				$str = '';
				foreach ($tmp as $k => $v) {
					if (strlen(str_replace(" ", "", $v)) > 0)
					{
						$str .= trim($v);
						if ($k != count($tmp)-1)
						{
							$str .= ', ';
						}
					}
				}
			}

			$item[$key]['name'] = $str;

			$item[$key]['name'] = preg_replace('#\.{2,10}#', '', $item[$key]['name']);
			$item[$key]['name'] = @ucfirst($item[$key]['name']);
			}

		$this->twig->display('cat.html.twig', 
			[
				'category' => $item, 
				'next_page' => $model['next_page'],
				'curr_page' => $page,
				'cat_id' => $id
			]);

		return;
	}

}



?>