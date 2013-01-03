nodebooru
=========
An image board / file hosting application for Node.js

Components
-----
[Uncodin](http://uncod.in)'s Nativ ORM, which depends on:
* libboost
* libpq
* libsqlite3

Google's OAuth authentication service

[Node.js](http://nodejs.org) / Various NPM modules

ImageMagick (must be installed for thumbnail creation)

Setup
-----
1. If there are no ORM bindings already provided for your platform (e.g. 'obooru_windows.node'), you'll have to build them with ```make```. Otherwise, just use ```make deps``` to install all necessary Node modules.
2. Set up Google API access for the application in the [Google API Console](https://code.google.com/apis/console#access). Once registered, this information will need to be copied to the config file.
3. Create a config.js file by copying config.js-sample and editing it with the proper values.
4. Run ```node index.js``` to start the application.
