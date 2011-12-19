

generate : obooru.model
	../orawrm/gen_node.py ../orawrm/plat_node/ ../orawrm/plat_cpp/ ../orawrm/dep obooru.model orm/

copy : 
	cp orm/build/default/test.node obooru_darwin.node


deps : 
	npm install choreographer
	npm install bind
