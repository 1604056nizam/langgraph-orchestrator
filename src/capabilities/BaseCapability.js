export class BaseCapability {

    constructor(id, name, description, maxRetries = 2) {
        if (this.constructor === BaseCapability) {
            throw new Error("BaseCapability is abstract and cannot be instantiated directly.");
        }

        this.id = id;
        this.name = name;
        this.description = description;
        this.maxRetries = maxRetries;
    }

    async execute(query, state = {}) {
        throw new Error(`Error() must be implemented by subclass ${this.constructor.name}`);
    }

}
