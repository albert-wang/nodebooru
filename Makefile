# Usage: make PLATFORM=[windows,linux,darwin,freebsd,etc.]

proxy : all

generate : obooru.model
	cd nativ && python . clean && python . generate node ../obooru.model && cd -

build : generate 
	cd orm/; node-waf configure build; cd - 

copy : 
ifdef PLATFORM
	cp nativ/build/node/obooru.model/build/Default/test.node obooru_$(strip $(PLATFORM)).node || cp nativ/build/node/obooru.model/build/Release/test.node obooru_$(strip $(PLATFORM)).node 
else
	echo "PLATFORM not defined. Find 'test.node' under './nativ/build/node/obooru.model' and copy to './obooru_PLATFORM.node'."
endif

deps : 
	npm install .

all : build copy deps


