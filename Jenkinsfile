
pipeline {
    agent any

    environment {
        SKIP_CI = 'false'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check CI Skip') {
            steps {
                script {
                    def commitMessage = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()

                    echo "Latest commit: ${commitMessage}"

                    if (commitMessage.contains('[skip ci]')) {
                        env.SKIP_CI = 'true'
                        echo "CI skipped. This is a GitOps manifest update."
                    }
                }
            }
        }

        stage('Determine Version') {
            when {
                expression { env.SKIP_CI != 'true' }
            }
            steps {
                script {
                    env.APP_VERSION = sh(
                        script: "node -p \"require('./package.json').version\"",
                        returnStdout: true
                    ).trim()

                    env.IMAGE_TAG = env.APP_VERSION

                    echo "Building version: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Docker Image') {
            when {
                expression { env.SKIP_CI != 'true' }
            }
            steps {
                sh """
                    podman build \
                    --network=host \
                    -t localhost/ansalpandey/kubepractice:${IMAGE_TAG} .
                """
            }
        }

        stage('Push Docker Image') {
            when {
                expression { env.SKIP_CI != 'true' }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'YOUR_GHCR_CREDENTIAL_ID',
                        usernameVariable: 'GHCR_USER',
                        passwordVariable: 'GHCR_PASS'
                    )
                ]) {
                    sh '''
                        echo "$GHCR_PASS" | podman login ghcr.io \
                            -u "$GHCR_USER" --password-stdin

                        podman tag \
                            localhost/ansalpandey/kubepractice:${IMAGE_TAG} \
                            ghcr.io/squareupstudio/kubepractice:${IMAGE_TAG}

                        podman push \
                            ghcr.io/squareupstudio/kubepractice:${IMAGE_TAG}
                    '''
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline execution completed."
        }
    }
}
