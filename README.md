nodebooru
=========
An image board / file hosting application for Node.js

Components
-----
[Uncodin](http://uncod.in)'s ORM

Google's OAuth authentication service

[Node.js](http://nodejs.org) / Various NPM modules

ImageMagick (must be installed for thumbnail creation)

Setup
-----
1. Configure the Makefile by correctly setting the variables at the top of the file. 
2. If there are no ORM bindings already provided for your platform (i.e. 'obooru_windows.node'), you'll have to build them with ```make PLATFORM=[windows,linux,darwin,freebsd,etc.]```. Otherwise, just use ```make deps``` to install all necessary Node modules.
3. Set up Google API access for the application in the [Google API Console](https://code.google.com/apis/console#access). Once registered, this information will need to be copied to the config file.
4. Create a config.js file by copying config.js-sample and editing it with the proper values.
5. Run ```node index.js``` to start the application.
