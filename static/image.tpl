<!DOCTYPE html>
<html lang="en">
	<head>
		<link rel="stylesheet" href="http://twitter.github.com/bootstrap/1.4.0/bootstrap.min.css">
		<link href="/css/default.css" rel="stylesheet" type="text/css"/>
		<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js"></script>
	</head>
	<body>
		<div class="topbar">
			<div class="fill">
				<div class="container">
					<a class="brand" href="/">nodebooru</a>
				</div>
			</div>
		</div>
		
		<div class="container">

			<div class="content">

				<div class="page-header">
					<h1>nodebooru <small>A place for nyan cats</small></h1>
				</div>				

				<div class="row">
					<div class="span16">
						<div id="navigation">
							<form action='/tag/data' method='POST'>
								<input type='text' name='tag'/>
							</form>
							<ul class="tags">
								(: tags ~ <li><a href="tag/[:url_name:]">[:display_name:]</a> <span class='count'>[:count:]</span></li> :)
							</ul>							
						</div>
						<div id="full-image">
							<a href="(:imgpath:)"><img src="(:imgpath:)"/></a>
							<div id="image-stats">
								<div class='controls'>Edit | Respond</div>
								<h1>Comments</h1>
							</div>
						</div>
						
						<div class="clear"></div>
					</div>

				</div>

			</div>

			<footer>
				<p>Nyan Nyan Nyan</p>
			</footer>

		</div> <!-- /container -->

	</body>
</html>





