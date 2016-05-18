var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();
var Deferred = require('node-defer');
var accounting = require("accounting");

app.get('/', function(req, res){
	var pagesArray = [];
	var url="http://www.luxuryexchange.com/jewelry-and-watches";
	var jsonResult = [];
	var pageNumber = 1;

	var appendPageNumUrl = function(pageNum) {
		return url + "?page=" + pageNum;
	}

	//deferrer for finding the max page
	var maxPageDefer = new Deferred();
	request(url, function(error, response, html){
		if(!error) {
			var $ = cheerio.load(html);
			try {
				var lastPageNum = parseInt($('#content .pagination .links a:last-child').attr('href').substring(55));
				maxPageDefer.resolve(lastPageNum);
			} catch(e) {
				maxPageDefer.resolve(0);
			}
		} else {
			maxPageDefer.resolve(0);
		}

	});


	//now we know how many pages are in the content page
	maxPageDefer.then(function(lastPageNum) {
		//Parsing fail
		if(lastPageNum <= 0) return;
		//create an array of deferrers
		var deferArray = [];
		for(var i = 0; i < lastPageNum; i++) {
			deferArray[i] = new Deferred();
			request(appendPageNumUrl(i + 1), function(error, response, html){
				if(!error) {
					var $ = cheerio.load(html);
					var productList = $("#content .product-list .prod_hold").toArray();
					deferArray.pop().resolve(productList);
				}
			});
		}
		//promises will be resolved when all the web calls are finished
		Deferred.when.push(deferArray)().then(function() {
			var products = [];
			for(var index in arguments) 
				for(var index2 in arguments[index])
					products.push(arguments[index][index2]);
			//flattening
			products = products.reduce(function(a, b){
				return a.concat(b);
			});
			//now we have an array with all the product cherrio objects
			var jsonResults = [];
			products.forEach(function(product, i) {
				$ = cheerio.load(product);
				var json = {id: "", link: "" ,images: [], itemName: "", price: 0, isSoldOut: false};
				json.id = $(product).attr('id').substring(1);
				json.link = $($('.name a')[0]).attr('href');
				//getting names from the url
				json.itemName = json.link.substr(json.link.lastIndexOf('/') + 1).split('/').join(' ');
				json.isSoldOut = ($('.sold_out').length > 0) ? true : false;
				$('.image img').each(function(i,image) {
					json.images.push($(image).attr('src'));
				});
				var price = $('.price').contents().first().text().trim();
				//parse the price 
				if(price.length > 0) {
					price = accounting.parse(price);
				} else {
					price = 0;
				}
				json.price = price;
				jsonResults.push(json);
			});
			
			//everything is done, now return result
			res.setHeader('Content-Type', 'application/json');
			res.send(JSON.stringify(jsonResults));

		});


	});

});

app.listen('3000');

console.log('Server is running on port 3000');

exports = module.exports = app;