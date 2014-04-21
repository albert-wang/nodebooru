# Usage: make [all|deps|clean]

PLATFORM = `node -e 'console.log(process.platform);'`

proxy : all

generate : obooru.model
	cd nativ && python . clean && python . generate node ../obooru.model && cd -

copy : 
ifdef PLATFORM
	cp nativ/build/node/obooru.model/build/Default/nativ.node obooru_$(strip $(PLATFORM)).node || cp nativ/build/node/obooru.model/build/Release/nativ.node obooru_$(strip $(PLATFORM)).node 
else
	echo "PLATFORM not defined. Find 'nativ.node' under './nativ/build/node/obooru.model' and copy to './obooru_PLATFORM.node'."
endif

deps : 
	npm install --no-bin-links
	cd node_modules/nativ-server && npm install --no-bin-links && cd -

all : generate copy deps 

clean :
	rm -rf build node_modules
