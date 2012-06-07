# Usage: make PLATFORM=[windows,linux,darwin,freebsd,etc.]

BUILD_PATH = build/node/obooru.model/build/Release

proxy : all

generate : obooru.model
	python nativ generate node obooru.model

copy : 

ifdef PLATFORM
	cp $(BUILD_PATH)/test.node obooru_$(strip $(PLATFORM)).node
else
	echo "PLATFORM not defined. Copy '$(BUILD_PATH)/test.node' to './obooru_PLATFORM.node'."
endif

deps : 
	npm install .

all : generate deps copy

clean :
	rm -rf build node_modules
