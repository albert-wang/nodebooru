PLATFORM = linux

proxy : all

generate : obooru.model
	mkdir -p orm/
	orawrm/gen_node.py orawrm/plat_node/ orawrm/plat_cpp/ orawrm/dep obooru.model orm/

build : generate 
	cd orm/; node-waf configure build; cd - 

copy : 
	cp orm/build/Release/test.node obooru_$(strip $(PLATFORM)).node

deps : 
	npm install choreographer bind formidable mime express async flow imagemagick request temp passport passport-google-oauth

all : build copy deps
