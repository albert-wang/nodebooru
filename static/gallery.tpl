<!DOCTYPE html>
<html lang="en">
	<head>

		<link rel="stylesheet" href="http://twitter.github.com/bootstrap/1.4.0/bootstrap.min.css">
		<link href="/css/default.css" rel="stylesheet" type="text/css"/>
		<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js"></script>
		<script type="text/javascript">
			$(document).ready(function() {

				var dragTimer;
				$(document).on('dragover', function(e) {
				    var dt = e.originalEvent.dataTransfer;
				    if(dt.types != null && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.contains('application/x-moz-file'))) {
					$("#dropzone").show();
					window.clearTimeout(dragTimer);
				    }
				});
				$(document).on('dragleave', function(e) {
				    dragTimer = window.setTimeout(function() {
					$("#dropzone").hide();
					}, 25);
				});
				$("#dropzone").on('dragover', function (e) {
					e.preventDefault();
				});
				$("#dropzone").on('drop', function (e) {
					e.preventDefault();						
							
					var dt = e.originalEvent.dataTransfer;
					var files = dt.files;

					$("#dropzone").hide();

					if (files.length  >  0)
						handleFiles(files);
				});
				
			});

			function handleFiles(files) {

				file = files[0];
				
				var formdata = new FormData();
				formdata.append("image", file);

				var xhr = new XMLHttpRequest();
				xhr.open("POST", "/upload/data");
				xhr.onload = function(oEvent) {
					if (xhr.status == 200) {
						location.reload(true);
					} else {
						alert("Upload Failed");
					}
				}

				xhr.send(formdata);
			}
		</script>	

	</head>
	<body>
		<div class="topbar">
			<div class="fill">
				<div class="container">
					<a class="brand" href="#">nodebooru</a>
					<ul class="nav">
						<li><a class="active" href='/upload/'>Upload an image!</a></li>
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

						<div id="dropzone">
							Drop Your File Here!!!!!!
						</div>
						<div id="images">
							(: images ~	<p><a href="[:path:]"><img src="[:imgpath:]"/></a></p> :)
						</div>
						

						<div>
							(: pages ~	<a href="[:path:]">[:label:]</a> &nbsp; - &nbsp; :)
						</div>	
					</div>

				</div>

			</div>

			<footer>
				<p>Nyan Nyan Nyan</p>
			</footer>

		</div> <!-- /container -->

	</body>
</html>







