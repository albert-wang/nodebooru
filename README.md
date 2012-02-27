nodebooru
=========
An image board for Node

Setup
-----
1. Configure the Makefile by correctly setting the variables at the top of the file. 
2. If there are no ORM bindings already provided for your platform (i.e. 'obooru_windows.node'), you'll have to build them with ```make```. Otherwise, just use ```make deps``` to install all necessary Node dependencies.
3. Create a config.js file by copying config.js-sample and editing it with the correct values.
4. Run ```node index.js``` to start the application.
