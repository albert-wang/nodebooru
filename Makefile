
proxy : all

generate : obooru.model
	mkdir -p orm
	../orawrm/gen_node.py ../orawrm/plat_node/ ../orawrm/plat_cpp/ ../orawrm/dep obooru.model orm/

build : generate 
	cd orm/ ; node-waf configure build; cd - 

copy : 
	cp orm/build/default/test.node obooru_darwin.node

deps : 
	npm install choreographer
	npm install bind

all : build deps copy
