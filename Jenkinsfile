pipeline {
    agent any

    stages {
        stage('Build Docker Image') {
            steps {
                sh "podman build --network=host --no-cache -t localhost/ansalpandey/kubepractice:1.0.${env.BUILD_NUMBER} ."
            }
        }
        stage('Tag & Push Image to GHCR') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'your-credential-id', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')]) {
                    sh '''
                        echo "$GHCR_PASS" | podman login ghcr.io -u "$GHCR_USER" --password-stdin
                    '''
                }
                sh "podman tag localhost/ansalpandey/kubepractice:1.0.${env.BUILD_NUMBER} ghcr.io/squareupstudio/kubepractice:1.0.${env.BUILD_NUMBER}"
                sh "podman push ghcr.io/squareupstudio/kubepractice:1.0.${env.BUILD_NUMBER}"
            }
        }
    }
}