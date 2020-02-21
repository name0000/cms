<?php

namespace App\Model;

use \PDO;

class Model 
{	

	protected $dsn = "mysql:host=".DB_HOST.";dbname=".DB_NAME.";port=".DB_PORT.";charset=".DB_CHARSET;
	protected $opt = [
	    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
	    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
	    PDO::ATTR_EMULATE_PREPARES   => false,
	];

	protected $db;

	public function __construct()
	{
		$this->db = new PDO($this->dsn, DB_USER, DB_PASS, $this->opt);
	}

	public function postFeedback($a)
	{	
		$q = "INSERT INTO `comments` (items_id, title, text, author, rating, user_submit, date)
				VALUES (:id, :title, :feedback, :author, :rating, :user_submit, CURRENT_TIMESTAMP)";

		$stmt = $this->db->prepare($q); // stmt = statement
		$stmt -> execute([':id' => $a['id'], ':title' => $a['feedback_title'], ':feedback' =>$a['feedback_text'], ':author' => $a['feedback_name'], ':rating' => $a['feedback_rate'], ':user_submit' => $a['user_submit']]);

	}

	public function search($s)
	{
		$sql_query = '

			SELECT
				
				items.id,
				items.name,
				items.image,
				items.slug

			from items
			
			-- where
			-- MATCH (items.name) AGAINST (:s IN NATURAL LANGUAGE MODE)
			WHERE items.name LIKE :s

			limit 10
		';

		$stmt = $this->db->prepare($sql_query); // stmt = statement
		$stmt -> execute([':s' => '%'. str_replace(' ', '%', $s) . '%']);
		
		return $sql_res = $stmt -> fetchAll();
		
	}


	public function homePage() {

		$result = array();

		$sql_query = '

			SELECT DISTINCT

				comments.items_id,
				ANY_VALUE(comments.text) as text,
				ANY_VALUE(comments.title) as title,
				ANY_VALUE(comments.rating) as rating,

				-- ANY_VALUE(comments.author) as author,

				items.id as items_id,
				items.name as items_name,
				items.image as items_image,
				items.slug as items_slug

			from comments 

			join items ON (items.id = comments.items_id)
			
			where
			items.image is not null

			group by comments.items_id

			limit 10
		';

		$stmt = $this->db->prepare($sql_query); // stmt = statement
		$stmt -> execute();

		$result['comments'] = $sql_res = $stmt -> fetchAll();

		$sql_query = '

			SELECT
				
				items.id,
				items.name,
				items.image, 
				items.slug

			from items

			where items.image is not NULL
			
			limit 100		
		';

		$stmt = $this->db->prepare($sql_query); // stmt = statement
		$stmt -> execute();
		
		$sql_res = $stmt -> fetchAll();

		$result['items'] = $sql_res;

		return $result;
	}

	public function catPage($id, $page) {

		$offset = $page;
		if ($page>0)
			$offset = $page-1;

		$sql_query = '

			SELECT
				
				items.id,
				items.name,
				items.image,
				items.slug,

				categories_names.name as cats,
				categories_names.id as cats_id 

			from items

			inner join categories ON (items.id = categories.items_id)
			inner join categories_names ON (categories_names.id = categories.categories_names_id)
			
			where
			categories.categories_names_id = '.$id.' 

			limit '.(CATEGORY_ITEMS_PER_PAGE+1).'
			offset '.($offset*CATEGORY_ITEMS_PER_PAGE).'
		';

		$stmt = $this->db->prepare($sql_query); // stmt = statement
		$stmt -> execute();
		
		$sql_res = $stmt -> fetchAll();

		foreach ($sql_res as $key => $value) {
			$sql_query = 'select text from comments where items_id = '.$value['id'].' limit 1';
			$stmt = $this->db->prepare($sql_query);
			$stmt -> execute(); 
			$t = $stmt -> fetchAll();
			if (isset($t[0]['text']))
				$sql_res[$key]['text'] = $t[0]['text'];
		}

		$next_page = false;
 
		if (count($sql_res)>CATEGORY_ITEMS_PER_PAGE)
		{
			$next_page = true;
			array_pop($sql_res);
		}

		return array('sql_res' => $sql_res, 'next_page' => $next_page);

	}

	public function itemPage($id) {

		// artist data

		$sql_query = '

			SELECT
				
				items.id,
				items.name,
				-- items.address,
				items.website,
				items.image,
				items.slug,
				-- items.am_id,
				items.date_created,

				categories_names.name as cats,
				categories_names.id as cats_id, 

				images.url as images

			from items

			left join categories ON (items.id = categories.items_id)
			left join categories_names ON (categories_names.id = categories.categories_names_id)
			left join images ON (items.id = images.items_id)

			where
			items.id = '.$id.'
		';

		$stmt = $this->db->prepare($sql_query); 
		$stmt -> execute();
		
		$sql_res = $stmt -> fetchAll();

		// flattering results
		foreach ($sql_res as $tmp) {
			foreach ($tmp as $tmp_key => $tmp_value) {
				if (!isset($res[$tmp_key]))
					$res[$tmp_key] = $tmp_value;
				else {
					if (is_array($res[$tmp_key]))
					{
						if (!in_array($tmp_value, $res[$tmp_key]))
							$res[$tmp_key][] = $tmp_value;
					} else {
						if ($res[$tmp_key] != $tmp_value)
						{
							$res[$tmp_key] = array($res[$tmp_key]);
							$res[$tmp_key][] = $tmp_value;
						}
					}
				}
			}
		}

		// neighboring items by id

		$sql_query = '

			(SELECT id,name,slug from items where id > '.$id.' limit 4)
			UNION
			(SELECT id,name,slug from items where id = (select max(id) from items where id < '.$id.'))
		';

		$stmt = $this->db->prepare($sql_query);
		$stmt -> execute();
		
		$sql_res = $stmt -> fetchAll();

		$res['neighbors'] = array();

		foreach ($sql_res as $key => $value) {
			$res['neighbors'][] = array('name'=>$value['name'], 'id'=>$value['id'], 'slug'=>$value['slug']);
		}


		/* Comments
		* CMS has an option to drip feed comments no matter if they are dated pre or post today's date. 
		* Here we are checking how many comments can be published based on options in config.php
		*/
		$max_comments = MAX_COMMENTS_PER_PAGE;

		if (defined('POSTPONED_COMMENT_PUBLISH') and POSTPONED_COMMENT_PUBLISH === true) {

			$now = time(); 
			$start_date = strtotime(FIRST_ITEM_DATE); //strtotime($res['date_created']);
			$datediff = $now - $start_date;
			$datediff =  round($datediff / (60 * 60 * 24));

			$max_comments = round($datediff / PUBLISH_ONE_COMMENT_EACH_DAYS); // 1 comment each "PUBLISH_ONE_COMMENT_EACH_DAYS" days

			if ($max_comments<MINIMUM_COMMENTS)
				$max_comments = MINIMUM_COMMENTS;

			// making early added items have MINIMUM_COMMENTS_FIRST_items comments
			// if (strtotime($res['date_created']) < strtotime(FIRST_ITEMS_LATEST_DATE) and $max_comments < MINIMUM_COMMENTS_FIRST_ITEMS)
			// 	$max_comments = MINIMUM_COMMENTS_FIRST_ITEMS;

			// no more than MAX_COMMENTS_PER_PAGE will be displayed
			if ($max_comments > MAX_COMMENTS_PER_PAGE)
				$max_comments = MAX_COMMENTS_PER_PAGE;
		}

		// user comments as a stand-alone query

		// $sql_query = '

		// 	SELECT

		// 		comments.text as text,
		// 		comments.title as title,
		// 		comments.avatar as avatar,
		// 		comments.rating as rating,
		// 		comments.author as author

		// 	from comments 

		// 	where
		// 	user_submit = 1 and
	 
		// 	comments.items_id = '.$id.' 
		// 	ORDER BY date
		// 	limit '.$max_comments.'
		// ';

		// $stmt = $this->db->prepare($sql_query); // stmt = statement
		// $stmt -> execute();
		
		// $res['comments'] = $stmt -> fetchAll();

		// all comments


		$sql_query = '

			SELECT

				comments.text as text,
				comments.title as title,
				comments.avatar as avatar,
				comments.rating as rating,
				comments.author as author,
				comments.date as date

			from comments 

			where
			-- user_submit is NULL and
			-- date <= CURDATE() and
			comments.items_id = '.$id.' 
			ORDER BY date
			limit '.$max_comments.'
		';

		$stmt = $this->db->prepare($sql_query); // stmt = statement
		$stmt -> execute();
		
		$res['comments'] =  $stmt -> fetchAll(); //array_merge($res['comments'],$stmt -> fetchAll());

		// print_r($res['comments']);

		return $res;

	}

}

  
