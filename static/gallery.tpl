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
							

					console.log(e);
					var dt = e.originalEvent.dataTransfer;
					console.log(dt);
					var files = dt.files;

					console.log(files);

					if (files.length  >  0)
						handleFiles(files);
				});
				
			});

			function handleFiles(files) {

				file = files[0];

				var reader = new FileReader();
				

				reader.onload = function(e) {
					var xhr = new XMLHttpRequest();
					var boundary = '---------------------------';
					xhr.open("POST", "/upload/data/", true);
					boundary += Math.floor(Math.random()*32768);
					boundary += Math.floor(Math.random()*32768);
					boundary += Math.floor(Math.random()*32768);
					xhr.setRequestHeader("Content-Type", 'multipart/form-data; boundary=' + boundary);
					var body = '';
					body += '--' + boundary + '\r\n' + 'Content-Disposition: form-data; name="';
					body += "image";
					body += '; filename="' + file.fileName  + '"'; 
					body += "Content-Type: image" + '\r\n'; 
					body += 'Content-Transfer-Encoding: binary' + '\r\n';
					body += '"\r\n\r\n';
					body += e.target.result;
					body += '\r\n'
					body += '--' + boundary + '--';
					xhr.onload = function() {
					}
					
					console.log(body);
					
					xhr.send(body);	
				};

				reader. readAsBinaryString(file);
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







