pipeline {
    agent any
    stages {
        stage('Determine Version') {
            steps {
                script {
                    env.APP_VERSION = sh(script: "grep '\"version\"' package.json | cut -d '\"' -f 4 | head -n 1", returnStdout: true).trim()
                    env.IMAGE_TAG = "${env.APP_VERSION}"
                    echo "Building and pushing version: ${env.IMAGE_TAG}"
                }
            }
        }
        stage('Build Docker Image') {
            steps {
                sh "podman build --network=host --no-cache -t localhost/ansalpandey/kubepractice:${env.IMAGE_TAG} ."
            }
        }
        stage('Tag & Push Image to GHCR') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'e6c0b173-c312-4fea-856d-29bbdca656c6', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')]) {
                    sh '''
                        echo "$GHCR_PASS" | podman login ghcr.io -u "$GHCR_USER" --password-stdin
                    '''
                }
                sh "podman tag localhost/ansalpandey/kubepractice:${env.IMAGE_TAG} ghcr.io/squareupstudio/kubepractice:${env.IMAGE_TAG}"
                sh "podman push ghcr.io/squareupstudio/kubepractice:${env.IMAGE_TAG}"
            }
        }
    }
}