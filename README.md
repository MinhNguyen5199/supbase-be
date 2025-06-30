# ISummarize Backend

ISummarize is a feature-rich, serverless backend for a web application that offers book summaries, reviews, and a unique gamified quest system. It's built with a modern, scalable, and serverless architecture, leveraging AWS Lambda for compute and a host of other services for its various features.

## Features

### Core Functionality
* **User Management**: User authentication and profile management are handled through Supabase. It includes logic for creating new users, retrieving user profiles, and identifying student users based on their email address for special pricing tiers.
* **Book and Summary Management**: Administrators have the ability to create, and update book information and their summaries.
* **Reviews and Ratings**: Users can create, read, update, and delete reviews for books.

### AI-Powered Content
* **Audio Summaries**: Pro and VIP users can generate audio versions of book summaries using ElevenLabs' text-to-speech technology.
* **Video Summaries**: VIP users can generate personalized video summaries using Tavus. The backend handles the creation, status checking, and management of these videos.

### Payments and Subscriptions
* **Stripe Integration**: Secure payment processing for subscriptions is handled by Stripe. Users can create checkout sessions, manage their subscriptions through a customer portal, upgrade or downgrade their plans, and cancel their subscriptions.
* **Tiered Access**: The application supports multiple subscription tiers, including "pro" and "vip", with special pricing for students.

### Gamification
* **Reddit Integration**: A quest system is integrated with Reddit. Users can link their Reddit accounts, and upon completing quests, a log is posted to a designated subreddit.
* **Algorand NFT Badges**: As users complete certain quests, they can be awarded with NFT badges minted on the Algorand blockchain.

## How the Application Uses AWS Lambda

The ISummarize backend is architected as a **serverless application**, with **AWS Lambda** at its core. Here's a breakdown of how it's used:

* **Monolithic Lambda Function**: Instead of deploying numerous individual Lambda functions for each API endpoint, this project uses a more streamlined approach. It deploys a single AWS Lambda function that contains a complete Express.js application. This is made possible by the `serverless-http` library, which acts as a compatibility layer between the Express app and the Lambda invocation event.

* **API Gateway Trigger**: **Amazon API Gateway** is configured to trigger this Lambda function for any incoming HTTP request (`httpApi: '*'`). API Gateway routes all traffic to the Lambda function, and the Express.js router within the application then handles the request and directs it to the appropriate controller logic.

* **Benefits of this Approach**:
    * **Simplified Deployment**: Managing a single Lambda function is simpler than managing dozens of them.
    * **Familiar Development Experience**: Developers can build and test the application locally as a standard Express.js app, which is a familiar and well-established development pattern.
    * **Scalability and Cost-Effectiveness**: By using AWS Lambda, the application benefits from automatic scaling based on demand. You only pay for the compute time you consume, making it a cost-effective solution.
    * **Centralized Logic**: All the application's routes and logic are contained within a single codebase, making it easier to manage and understand the application's overall structure.

* **Serverless Framework**: The project uses the **Serverless Framework** to define and deploy the AWS infrastructure. The `serverless.yml` file specifies the AWS provider, the Lambda function's configuration (including its runtime and environment variables), and the API Gateway trigger. This "Infrastructure as Code" approach makes the deployment process repeatable and reliable.

## Getting Started

### Prerequisites
* Node.js (v22.x)
* An AWS account
* Serverless Framework CLI
* Supabase, Stripe, ElevenLabs, Tavus, Reddit, and Algorand API keys and credentials.

### Installation
1.  Clone the repository:
    ```bash
    git clone [https://github.com/minhnguyen5199/supbase-be.git](https://github.com/minhnguyen5199/supbase-be.git)
    cd supbase-be
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file and populate it with your API keys and credentials, using the `serverless.yml` file as a template for the required environment variables.
4.  Deploy the application to AWS:
    ```bash
    serverless deploy
    ```
