PLATFORM = darwin

proxy : all

generate : obooru.model
	mkdir -p orm/
	orawrm/gen_node.py orawrm/plat_node/ orawrm/plat_cpp/ orawrm/dep obooru.model orm/

build : generate 
	cd orm/; node-waf configure build; cd - 

copy : 
	cp orm/build/Default/test.node obooru_$(strip $(PLATFORM)).node ; cp orm/build/Release/test.node obooru_$(strip $(PLATFORM)).node 

deps : 
	npm install .

all : build copy deps
