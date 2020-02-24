# Hello :)

This repo is a primitive, but easy and convenient mini web framework based on MVC.
Queries to database are implemented with raw PDO requests.
Includes autowiring, Twig is used for view files.

This is an instruction on how to install the framework. You'll need php, composer, mysql and git on your system. 

The instruction below is for linux and mac users, but i suppose that steps on Windows would be very similar, thaw i have not had a chance to test installation workflow on Windows yet.

## How to Install

Steps: 

0 - I assume you have composer installed globally. 
We'll need a database, please create it. Lets assume the name for the database is "yourdb", i'll use it further on this page.

1 - copy git repo, run composer install

```
git clone git@github.com:name0000/cms.git . # mind the dot
cd app
composer install
```

2 - add databse structure
```
mysql yourdb < db_struct.sql
```
3 - edit database access /app/src/config.php

```
define('DB_NAME','yourdb'); 
define('DB_USER','username');
define('DB_PASS','pwd');
```

4 - start server. Go to the folder where you cloned the git repo and:
```
php -S localhost:9090 -t app/public
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