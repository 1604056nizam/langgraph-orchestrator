module.exports = {
    apps: [
        {
            name: "langgraph-chat",
            script: "./server.js",
            env: {
                NODE_ENV: "production",
                PORT: 4000
            }
        }
    ]
};