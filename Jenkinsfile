pipeline {
    agent any

    environment {
        BACKEND_IMAGE  = "yourusername/secure-doc-backend:latest"
        FRONTEND_IMAGE = "yourusername/secure-doc-frontend:latest"
        VITE_API_URL   = "https://secure-cloud-document.onrender.com/api"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Backend Image') {
            steps {
                dir('backend') {
                    sh "docker build -t ${BACKEND_IMAGE} ."
                }
            }
        }

        stage('Build Frontend Image') {
            steps {
                dir('frontend') {
                    sh "docker build --build-arg VITE_API_URL=${VITE_API_URL} -t ${FRONTEND_IMAGE} ."
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    sh "docker push ${BACKEND_IMAGE}"
                    sh "docker push ${FRONTEND_IMAGE}"
                }
            }
        }

        stage('Deploy to Render') {
            steps {
                withCredentials([string(
                    credentialsId: 'render-deploy-hook',
                    variable: 'RENDER_HOOK'
                )]) {
                    sh 'curl -X POST "$RENDER_HOOK"'
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
        success {
            echo '✅ Pipeline succeeded — images pushed to Docker Hub and Render redeploy triggered.'
        }
        failure {
            echo '❌ Pipeline failed — check the stage logs above for the exact command that broke.'
        }
    }
}