# GitFlowCaptain

It's a CLI tool that helps to automate the process of creating and merging branches, creating pull requests, updating the version of the project, and managing Git submodules.
For current moment it supports these tasks:

- Preconfigured link merged submodules
- Interactive link merged submodules
- Interactive change remote for feature branches
- Interactive switch branches between main project and submodules
  
## Requirements

- Node.js 20 or later (lower not tested)
- npm 6 or later
- Git 2.13.0 or later

## Configuration Guide for `config.json`

The `config.json` file is a crucial part of setting up your project environment. It defines the pull request providers and project configurations, including repository details and submodules. Below is a guide on how to fill out this configuration file.

### Pull Request Providers (`prProviders`). Now support Azure DevOps and GitLab only (You are welcome to contribute to add more providers:) )

- **`provider`**: The name of the service provider for pull requests (e.g., `AzureDevOps`).
- **`project`**: The name of the project within the provider.
- **`organization`**: The name of the organization under which the project is hosted.
- **`host`**: The url of the host for the provider.

Example:
```json
{
  "prProviders": [
    {
      "provider": "AzureDevOps",
      "project": "projectName",
      "organization": "organizationName",
      "host": "https://...."
    }
  ]
}
```

### Projects Configuration (`projects`)

Each project object within the `projects` array should contain the following fields:

- **`name`**: The name of the project.
- **`repositoryId`**: The identifier for the repository.
- **`path`**: The local file system path to the project.
- **`baseBranch`**: The branch name used for merging changes.
- **`remoteName`**: The name of the remote repository (commonly `origin`).
- **`remoteUrl`**: The url of the remote repository.
- **`submodules`**: An array of submodule objects, if any, associated with the project.

#### Submodules

Each submodule object should include:

- **`name`**: The name of the submodule.
- **`baseBranch`**: The branch name used for merging changes within the submodule.
- **`remoteName`**: The name of the remote repository for the submodule.
- **`remoteUrl`**: The url of the remote repository for the submodule.
- **`repositoryId`**: The id of the repository for the submodule.



Example Project Configuration:
```json
{
  "projects": [
    {
      "name": "Name for your convenience",
      "repositoryId": "repositoryNameOrIdDependsOnProvider",
      "path": "/absolute/path/to/project",
      "baseBranch": "develop",
      "remoteName": "origin",
      "remoteUrl": "remoteUrl",
      "submodules": [
        {
          "name": "submodule1",
          "baseBranch": "develop",
          "remoteName": "origin",
          "remoteUrl": "remoteUrl",
          "repositoryId": "repositoryNameOrIdDependsOnProvider"
        },
      ]
    }
  ]
}
```


### Filling the Configuration

1. **Identify your PR provider(s)**: Fill in the `prProviders` section with details about your pull request service provider(s).
2. **List your projects**: Under the `projects` array, add an object for each project you're working on. Include all relevant details as described above.
3. **Specify submodules (if any)**: For projects with submodules, ensure each submodule is listed with its corresponding details under the project's `submodules` array.

This configuration file is essential for managing your projects and their dependencies effectively. Ensure all details are accurate and up-to-date.


## Usage

1. Install dependencies with the command `npm install`
2. Create a file `.env` based on `.env.example` and configure it accordingly.
3. Create a file `config.json` based on `config.example.json` and configure it accordingly.
4. Run the tool with the command `npm run start`
5. Select the desired task from the interactive menu:
   - Preconfigured link merged submodules
   - Interactive link merged submodules
   - Interactive change remote for feature branches
   - Interactive switch branches

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit contributions.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.