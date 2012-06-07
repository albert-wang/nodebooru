# Usage: make PLATFORM=[windows,linux,darwin,freebsd,etc.]

BUILD_PATH = build/node/obooru.model/build/Release
PLATFORM = `node -e 'console.log(process.platform);'`

proxy : all

generate : obooru.model
	python nativ generate node obooru.model

copy : 
	cp $(BUILD_PATH)/test.node obooru_$(strip $(PLATFORM)).node

deps : 
	npm install .

all : generate deps copy

clean :
	rm -rf build node_modules
