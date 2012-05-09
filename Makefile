# Usage: make PLATFORM=[windows,linux,darwin,freebsd,etc.]

proxy : all

generate : obooru.model
	mkdir -p orm/
	python nativ gen node obooru.model orm/

build : generate 
	cd orm/; node-waf configure build; cd - 

copy : 
ifdef PLATFORM
	cp orm/build/Default/test.node obooru_$(strip $(PLATFORM)).node || cp orm/build/Release/test.node obooru_$(strip $(PLATFORM)).node 
else
	echo "PLATFORM not defined. Find 'test.node' under './orm/build' and copy to './obooru_PLATFORM.node'."
endif

deps : 
	npm install .

all : build copy deps

obooru : 
	./generate.py ../obooru/obooru.model out
	cd out/node ; node-waf configure build; cd -
	cp out/node/build/default/test.node ../obooru/obooru_darwin.node




