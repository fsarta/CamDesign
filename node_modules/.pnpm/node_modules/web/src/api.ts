const API_BASE_URL = 'http://localhost:3000/api';

export interface Project {
    id: string;
    name: string;
    description: string | null;
}

export const fetchProjects = async (): Promise<Project[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/projects`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
    }
};
