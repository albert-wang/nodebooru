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
				$("#dropzone").on('drop', function (e) {
					event.preventDefault();						
	
					var dt = e.dataTransfer;
					var files = dt.files;

					if (count >  0)
						handleFiles(files);
				});
				
			});

			function handleFiles(files) {

				file = files[0];
				var xhr = new XMLHttpRequest();
				xhr.upload.addEventListener('progress', uploadProgress, false);
				xhr.onreadystatechange = stateChange;
				xhr.open('POST', '/upload/data', true);
				xhr.setRequestHeader('X-FILE-NAME', file.name);
				xhr.send(file);
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







