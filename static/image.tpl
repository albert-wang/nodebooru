<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/> 
		<link rel="stylesheet" href="http://twitter.github.com/bootstrap/1.4.0/bootstrap.min.css">
		<link href="/css/default.css" rel="stylesheet" type="text/css"/>
		<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js"></script>
		<script type="text/javascript" src="/css/jquery.raty.js"></script>
		<script type="text/javascript">
			$(document).ready(function()
			{
				$("#edit-button").click(function()
				{
					if (event.preventDefault)
					{
						event.preventDefault();
					}
					$("#edit-tags").toggle('fast');
				});

				$("#comment-button").click(function()
				{
					if (event.preventDefault)
					{
						event.preventDefault();
					}
					$("#add-comment").toggle('fast');
				});

				$("#delete-image").click(function()
				{
					var shouldDelete = window.confirm("Do you really want to delete this image?");
					if (shouldDelete)
					{
						$.post("/delete/image/(:hash:)", function() 
						{
							window.location = "/gallery";
						});
					}
				});
				
				$("#submit-tags").click(function()
				{
					$.post("/tag/set", { "newtags": $("#image-tags").val(), "filehash" : "(:hash:)" }, function() 
					{ 
						location.reload();
					});
				});

				$("#submit-comment").click(function()
				{
					$.post("/comment/set", { "comment" : $("#comment-entry").val(), "filehash" : "(:hash:)" }, function()
					{
						location.reload();
					});
				});

				$("#add-comment").toggle('fast');
				$(".ratings").raty(
				{
					starOn : "star-on.png",
					starOff: "star-off.png",
					path: "/css/",
					start: (:your-rating:),
					click: function(score)
					{
						$.post("/rating/modify", { "imgid" : "(:hash:)", "rating" : score || 0 }, function()
						{

						});
					}
				});
			});
		</script>
	</head>
	<body>
		<div class="topbar">
			<div class="fill">
				<div class="container">
					<a class="brand" href="/">nodebooru</a>
					<ul class="nav">
						<li><a href="/upload">Upload</a></li>
					</ul>
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
								(: tags ~ <li>
									<a href="/tag/[:url_name:]">[:display_name:]</a> <span class='count'>[:count:]</span></li> 
								:)
							</ul>
							<ul>
								<li class='header'><b>Statistics</b></li>
								<li><b>Uploaded:</b> (:time:)</li>
								<li><b>By:</b> (:uploadedBy:)</li>
								<li><b>Type:</b> (:mimetype:)</li>
								<li><b>Avg Rating: </b> (:average-rating:)</li>
								<li><b>Your Rating:</b></li>
								<li><div class="ratings"></div></li>

								(: is-admin? ~ 
									<li class='header'><b>Administration</b></li>
									<li><a id='delete-image' href='#'>Delete</a></li>
								:)
							</ul>
						</div>
						<div id="full-image">
							(:content:)
							<div id="image-stats" name='image-stats'>
								<div class='controls'>
									<a href='#' id='edit-button'>Edit</a>
								</div>

								<div id="edit-tags">
									<h3>Edit Tags</h3>
									<form>
										<textarea id="image-tags">(:original-tags:)</textarea><br/>
										<input type='button' value='Save Changes' id='submit-tags'/>
									</form>
								</div>
								<div id="add-comment">
									<h2>Comments</h2>
									<ul class="comments">
									(: comments ~ 
										<li><p>
											[:contents:] - [:author:]
										</p></li>
									:)
									</ul>

									<form>
										<textarea id='comment-entry'></textarea></br/>
										<input type='button' value='Add Comment' id='submit-comment'/>
									</form>
								</div>
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





