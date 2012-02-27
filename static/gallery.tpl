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

				$("#masstag").click(function()
				{
					$(".tagclick").show();
					$("#sali").show();
					$("#teli").show();
				});

				$("#select-all").click(function()
				{
					$(".tagclick").prop("checked", true);
				});

				$("#tagem").click(function()
				{
					$("#masstaginputs").show('fast');
				});

				$("#submit").click(function()
				{
					var affected = [];
					$(".tagclick:checked").each(function(i, elm)
					{
						affected.push($(this).attr("id"));
					});

					$.post("/tag/batch", { "imgs" : affected, "tags" : $("#image-tags").val() }, function()
					{
						location.reload();
					});
				});
			});

			function handleFiles(files) {

				var formdata = new FormData();
				for (var i in files) {
					formdata.append("image" + i , files[i]);
				}

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
					<a class="brand" href="/">nodebooru</a>
					<ul class="nav">
						<li><a href="/upload">Upload</a></li>
						<li style="margin-left: 10px"><a href="#" id="masstag">Batch Tagging</a></li>
						<li style="display: none" id="sali"><a href="#" id='select-all'>Select All</a></li>
						<li style="display: none" id="teli"><a href="#" id='tagem'>Set Tags</a></li>
					</ul>
				</div>
			</div>
		</div>
		
		<div class="container">

			<div class="content">

				<div class="page-header">
					<h1>nodebooru <small>A place for nyan cats</small></h1>
				</div>				

				<div id="masstaginputs" style="display: none; margin-bottom: 30px; width: 100%;">
					<h3>Edit Tags</h3>
					<textarea style="width: 100%; min-height: 80px;" id="image-tags"></textarea><br/>
					<input type='button' value='Save Changes' id='submit'/>
				</div>

				<div class="row">
					<div class="span16">
						<div id="dropzone">
							Drop Your File Here!!!!!!
						</div>
						<div id="navigation">
							<form action='/tag/data' method='POST'>
								<input type='text' name='tag'/>
							</form>
							<ul class="tags">
								(: tags ~ <li>
									<a href="/tag/[:extra:]+[:url_name:]">+</a>
									<a href="/tag/[:url_name:]">[:display_name:]</a> <span class='count'>[:count:]</span></li> 
								:)
							</ul>
						</div>
						<div id="images">
							(: if[is-empty] ~ 
								[: then ~ <h1>Nobody here but us nyancats!</h1> :]
								[: else ~ :]
							:)

							(: images ~
								<div>
									<a href="[:path:]"><img src="[:imgpath:]"/></a>
									<input type='checkbox' style='display: none;' class='tagclick' id='[:imghash:]'/>
								</div>
							:)
						</div>
						
						<div class="clear"></div>
						<div class="pages">
							<h4>
							(: pages ~	<a href="[:path:]">[:label:]</a> &nbsp; - &nbsp; :)
							</h4>
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







