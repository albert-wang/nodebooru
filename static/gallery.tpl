<!DOCTYPE html>
<html lang="en">
	<head>
		<link href="/css/default.css" rel="stylesheet" type="text/css"/>
	</head>
	<body>
		<div id="header">
			<span>Most recently uploaded images</span>
			<a class="button" href='/upload/'>Upload an image!</a>
		</div>
		<br/>

		<div id="container">
			<div id="navigation">
				<ul>
					(: tags ~ <li>[:fullname:]</li> :)
				</ul>
			</div>
			<div id="images">
				(: images ~	<p><a href="[:path:]"><img src="[:imgpath:]"/></a></p> :)
			</div>
		</div>
	</body>
</html>







