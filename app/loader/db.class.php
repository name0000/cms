<?php

class Db {

	public $db;

	function __construct() {

		$dsn = "mysql:host=".DB_HOST.";dbname=".DB_NAME.";port=".DB_PORT.";charset=".DB_CHARSET;
		$opt = [
			PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
			PDO::ATTR_EMULATE_PREPARES   => false,
		];

		$this->db = new PDO($dsn, DB_USER, DB_PASS, $opt);
	}


	public function checkIfItemExists($item) {

		$db = $this->db;

		// checking if data is already inside
		$q = 'SELECT id from items where name = :name';

		$stmt = $db->prepare($q);
		$stmt -> execute([':name' => $item['name']]);

		$res = $stmt -> fetchAll();

		if (count($res)<1)
			return false;
		else
			return $res[0]['id'];
	}

	public function cast($q) {

		$db = $this->db;
		
		$stmt = $db->prepare($q);
		$stmt -> execute();

		return $stmt -> fetchAll();
	}

	public function checkIfCommentExistsByAuthor($item, $author, $remove = false) {

		$db = $this->db;

		// checking if item is present 

		$q = 'SELECT id from items where name = :name';

		$stmt = $db->prepare($q);
		$stmt -> execute([':name' => $item['name']]);

		$res = $stmt -> fetchAll();

		if (count($res)<1)
			return false;
		else
			return true;

		// checking comments for the item

		$items_id = $res[0]['id'];

		$q = 'SELECT id from comments where items_id = :items_id and author = :author'; // ALL comments by specified author

		$stmt = $db->prepare($q);
		$stmt -> execute([':items_id' => $items_id, ':author' => $author]);

		$res = $stmt -> fetchAll();

		if (count($res)<1)
			return false;
		else
			return true;

		// removing all found comments

		if ($remove == true)
			$q = 'DELETE from comments where items_id = :items_id and author = :author'; // ALL comments by specified author

		$stmt = $db->prepare($q);
		$stmt -> execute([':items_id' => $items_id, ':author' => $author]);

		return;
	}

	public function addItem($item) {

		$db = $this->db;

		$id = $this->checkIfItemExists($item);

		if ($id === false)
		{
			$q = "INSERT into items (name, image, slug, website) values (:name, :image, :slug, :website)";

			$stmt = $db->prepare($q);
			$stmt -> execute([':name' => $item['name'], ':image' => $item['image'], ':slug' => $item['slug'], ':website' => $item['website']]);
			$id = $db->lastInsertId();

		} else {

			$q = "UPDATE items set image = :image, slug = :slug, website = :website where id = :id";
			$stmt = $db->prepare($q);
		  //print_r($stmt);
			$stmt -> execute([':image' => $item['image'], ':slug' => $item['slug'], ':website' => $item['website'], ':id' => $id]);
		}

		// inserting categories [ ПРЕДПОЛАГАЕМ, ЧТО КАТЕГОРИИ НЕ МЕНЯЮТСЯ И ПОЭТОМУ ИХ МЕНЯТЬ\УДАЛЯТЬ НЕ НУЖНО. ТОЛЬКО ДОПОЛНЯТЬ/ВНОСИТЬ НОВЫЕ ]


		if (isset($item['cats']) and count($item['cats'])>0)
		{
			foreach ($item['cats'] as $key => $value) {
		    
				$q = 'SELECT id from categories_names where name = :name';
				$stmt = $db->prepare($q);
				$stmt -> execute([':name' => $value]);

				$res = $stmt -> fetchAll();

				if (count($res)<1)
				{
					$q = 'INSERT into categories_names (name) values (:name)';
					$stmt = $db->prepare($q);
					$stmt -> execute([':name' => $value]);
					$cat_name_id = $db->lastInsertId();
				}  else
					$cat_name_id = $res[0]['id'];

				$q = 'SELECT id from categories where categories_names_id = :cat_name_id and items_id = :id';
				$stmt = $db->prepare($q);
				$stmt -> execute([':cat_name_id' => $cat_name_id, ':id' => $id]);

				$res = $stmt -> fetchAll();

				if (count($res)<1)
				{
					$q = 'INSERT into categories (categories_names_id, items_id) values (:categories_names_id, :items_id)';
					$stmt = $db->prepare($q);
					$stmt -> execute([':categories_names_id' => $cat_name_id, ':items_id' => $id]);
				}
				 
			}
		} // if (count($item['categories'])>0)

		return $id;
	}

	public function addComments($comments, $items_id) {

		foreach ($comments as $comment) {

			$db = $this->db;

			$q = 'INSERT INTO comments (items_id, /*title, */author, text, rating, avatar, date)
				VALUES (:items_id, /*:title, */:author, :text, :rating, :avatar, :date)';

			$stmt = $db->prepare($q);
			$stmt -> execute([
				':items_id'	=> $items_id, 	
				// ':title'	=> $comment['title'],
				':author'	=> $comment['author'],
				':text'		=> $comment['text'],
				':rating'		=> $comment['rating'], 
				':date'		=> $comment['date'], 
				':avatar'	=> $comment['avatar']
			]);

		}
	}

}

/*$item['name'] = 'test';
$item['image'] = 'app.png';
$item['author'] = 'test';
$item['cats'] = ['name1', 'name2'];
$item['am_id'] = 'random';

$comments = [

	['title' => 'some test title', 'author' => 'Marek', 'text' => 'text of the comment', 'rating' => 5, 'avatar' => 'user.png'],
	['title' => 'another test title', 'author' => 'Zurek', 'text' => 'text of the comment', 'rating' => 4, 'avatar' => 'user.png'],
	['title' => '3rd test title', 'author' => 'Alex', 'text' => 'text of the comment', 'rating' => 4, 'avatar' => 'user.png'],
	['title' => '4th test title', 'author' => 'Marta', 'text' => 'text of the comment', 'rating' => 5, 'avatar' => 'user.png'],
	['title' => '5th test title', 'author' => 'Some', 'text' => 'text of the comment', 'rating' => 5, 'avatar' => 'user.png'],

];

$handle = new Poster();
$id = $handle -> addItem($item);
$handle -> addComments($comments, $id);

*/