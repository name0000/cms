# CMS

Very simple CMS that based on MVC.
Queries to database are implemebted with raw PDO requests.

## How to Install

Steps: 

0 - create a database. Let us name it "yourdb"

1 - copy git repo, run composer install

```
git clone git@github.com:name0000/cms.git
composer install
```

2 - add databse structure
```
mysql yourdb < db_struct.sql
```
3 - configure /app/src/config.php

```
define('DB_NAME','yourdb');
```

4 - start server
```
php -S localhost:9090 -t /app/public
```

Now you should be able to access empty version of the website on localhost:9090


## Possible Issues

1 - Bunch of SQL errors when loading main page (localhost:9090/).

This means you probably have an earilier version of MySQL. Here is what you can do:
Remove ANY_VALUE function from /app/src/model.php in homePage method like this:

```
Here is how it looks by default:

ANY_VALUE(comments.text) as text,
ANY_VALUE(comments.title) as title,
ANY_VALUE(comments.rating) as rating,

Make it look like this:

comments.text as text,
comments.title as title,
comments.rating as rating,
```

## How to Add Example Content

/app/loader contains mechanisms for scraping content and adding to the database. 
Try launching 
```
php ./app/loader/i.php
```
/app/loader/source_lists/list.txt contains list or urls that will be fetched and parsed into the database. 