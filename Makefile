# Usage: make PLATFORM=[windows,linux,darwin,freebsd,etc.]

PLATFORM = `node -e 'console.log(process.platform);'`

proxy : all

generate : obooru.model
	cd nativ && python . clean && python . generate node ../obooru.model && cd -

copy : 
ifdef PLATFORM
	cp nativ/build/node/obooru.model/build/Default/test.node obooru_$(strip $(PLATFORM)).node || cp nativ/build/node/obooru.model/build/Release/test.node obooru_$(strip $(PLATFORM)).node 
else
	echo "PLATFORM not defined. Find 'test.node' under './nativ/build/node/obooru.model' and copy to './obooru_PLATFORM.node'."
endif

deps : 
	npm install .
	cd node_modules/nativ-server && npm install . && cd -

all : generate deps copy

clean :
	rm -rf build node_modules
