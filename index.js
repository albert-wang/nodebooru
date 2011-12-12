
var booru     = require("./obooru")                  //ORM
var http      = require("http")                      //Server
var route     = require("choreographer").router();   //Routing
var bind      = require("bind")                      //Templating


var datastore = new booru.PostgresDatastore("localhost", "albert", "albertowang");

route.get("/image/*", function(req, res, imageid)
{
	res.writeHead(200, {'Content-Type' : 'text/plain'});

	var kp = new booru.KeyPredicate("Image");
	kp.limit(20);

	datastore.getWithPredicate(kp, function(e, total, vals)
	{

		res.end(total + " images found in: " + imageid);
	});
});

route.get("/upload/", function(req, res)
{
	bind.toFile("static/index.tpl", { user: "Nyancat" }, function(data)
	{

		res.end(data);
	});
});

http.createServer(route).listen(3000)
console.log("Server is now listening on port 3000")















