export default {
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]sx?$": "babel-jest"
  },
  reporters: [
    "default",
    [
      "jest-html-reporters",
      {
        publicPath: "./reports",
        filename: "report.html",
        expand: true
      }
    ]
  ]
};