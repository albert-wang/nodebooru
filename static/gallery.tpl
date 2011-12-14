<!DOCTYPE html>
<html lang="en">
	<head>
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
				xhr.send(formdata);
			}
		</script>	

	</head>
	<body>
		<div id="header">
			<span>Most recently uploaded images</span>
			<a class="button" href='/upload/'>Upload an image!</a>
		</div>
		<br/>

		<div id="dropzone">
			Drop Your File Here!!!!!!
		</div>
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







