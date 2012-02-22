<!DOCTYPE html>
<html lang="en">
	<h1>Upload through a local file.</h1>
	<form action='/upload/data' enctype="multipart/form-data" method='POST'>
		<input type='file' name='image' multiple="multiple"/><br/>
		<input type='submit' value='Upload!'/>
	</form>


	<h1>Upload through a URL</h1>
	<form action='/upload/url' enctype="multipart/form-data" method="POST">
		<input type='text' name='imgurl'/><br/>
		<input type='submit' value='Upload!'/>
	</form>
</html>

