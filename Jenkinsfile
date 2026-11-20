pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Loop Guard') {
            steps {
                script {
                    def lastCommitMsg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    if (lastCommitMsg.contains('[skip ci]')) {
                        echo 'Manifest-only commit ([skip ci]) detected. Skipping build to prevent infinite loop.'
                        currentBuild.result = 'ABORTED'
                        error('Aborting: [skip ci] commit.')
                    }
                }
            }
        }

        stage('Determine Version') {
            steps {
                script {
                    env.APP_VERSION = sh(script: "grep '\"version\"' package.json | cut -d '\"' -f 4 | head -n 1", returnStdout: true).trim()
                    env.SHORT_SHA = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    env.IMAGE_TAG = "${env.APP_VERSION}-${env.SHORT_SHA}"
                    echo "Building and pushing version: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "podman build --network=host -t localhost/ansalpandey/kubepractice:${env.IMAGE_TAG} ."
            }
        }

        stage('Tag & Push Image to GHCR') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'e6c0b173-c312-4fea-856d-29bbdca656c6', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')]) {
                    sh '''
                        echo "$GHCR_PASS" | podman login ghcr.io -u "$GHCR_USER" --password-stdin
                        podman tag localhost/ansalpandey/kubepractice:${IMAGE_TAG} ghcr.io/squareupstudio/kubepractice:${IMAGE_TAG}
                        podman push ghcr.io/squareupstudio/kubepractice:${IMAGE_TAG}
                    '''
                }
            }
        }
    }

    post {
        always {
            sh '''
                podman logout ghcr.io || true
                podman image prune -f || true
            '''
        }
    }
}