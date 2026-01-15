import cv2
import numpy as np

class Segmentation:
    
    def edge_detection(self, img, method='canny', **kwargs):
        """
        Edge detection segmentation
        
        Parameters:
        - method: 'canny', 'sobel', or 'laplacian'
        - kwargs: method-specific parameters
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        if method == 'canny':
            low_threshold = kwargs.get('low_threshold', 50)
            high_threshold = kwargs.get('high_threshold', 150)
            edges = cv2.Canny(gray, low_threshold, high_threshold)
            
        elif method == 'sobel':
            ksize = kwargs.get('ksize', 3)
            sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=ksize)
            sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=ksize)
            edges = np.sqrt(sobel_x**2 + sobel_y**2)
            edges = np.uint8(edges / edges.max() * 255)
            
        elif method == 'laplacian':
            ksize = kwargs.get('ksize', 3)
            edges = cv2.Laplacian(gray, cv2.CV_64F, ksize=ksize)
            edges = np.uint8(np.absolute(edges))
            
        else:
            raise ValueError(f"Unknown method: {method}")
            
        return edges
    
    def threshold_segmentation(self, img, method='otsu', **kwargs):
        """
        Threshold-based segmentation
        
        Parameters:
        - method: 'otsu', 'adaptive', 'binary', 'multi'
        - kwargs: method-specific parameters
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        if method == 'otsu':
            _, result = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
        elif method == 'adaptive':
            block_size = kwargs.get('block_size', 11)
            c = kwargs.get('c', 2)
            result = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          cv2.THRESH_BINARY, block_size, c)
            
        elif method == 'binary':
            threshold = kwargs.get('threshold', 127)
            _, result = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
            
        elif method == 'multi':
            # Multi-level thresholding (3 levels)
            levels = kwargs.get('levels', [85, 170])
            result = np.zeros_like(gray)
            result[gray < levels[0]] = 0
            result[(gray >= levels[0]) & (gray < levels[1])] = 128
            result[gray >= levels[1]] = 255
            
        else:
            raise ValueError(f"Unknown method: {method}")
            
        return result
    
    def circle_detection(self, img, **kwargs):
        """
        Detect circles using Hough Circle Transform (for pipe ends)
        
        Parameters:
        - dp: inverse ratio of accumulator resolution
        - min_dist: minimum distance between circle centers
        - param1: higher threshold for Canny edge detector
        - param2: accumulator threshold
        - min_radius, max_radius: circle size constraints
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Preprocessing
        gray = cv2.equalizeHist(gray)
        gray = cv2.GaussianBlur(gray, (5, 5), 1.5)
        
        dp = kwargs.get('dp', 1)
        min_dist = kwargs.get('min_dist', 20)
        param1 = kwargs.get('param1', 50)
        param2 = kwargs.get('param2', 30)
        min_radius = kwargs.get('min_radius', 10)
        max_radius = kwargs.get('max_radius', 50)
        
        circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=dp, minDist=min_dist,
                                   param1=param1, param2=param2,
                                   minRadius=min_radius, maxRadius=max_radius)
        
        # Create visualization
        result = img.copy()
        mask = np.zeros(gray.shape, dtype=np.uint8)
        
        if circles is not None:
            circles = np.uint16(np.around(circles))
            for i in circles[0, :]:
                # Draw circle outline
                cv2.circle(result, (i[0], i[1]), i[2], (0, 255, 0), 2)
                # Draw center
                cv2.circle(result, (i[0], i[1]), 2, (255, 0, 0), 3)
                # Fill mask
                cv2.circle(mask, (i[0], i[1]), i[2], 255, -1)
        
        return result, mask, circles
    
    def kmeans_segmentation(self, img, n_clusters=3, **kwargs):
        """
        K-means clustering segmentation
        
        Parameters:
        - n_clusters: number of clusters
        - max_iter: maximum iterations
        """
        # Reshape image to 2D array of pixels
        pixel_values = img.reshape((-1, 3))
        pixel_values = np.float32(pixel_values)
        
        # K-means parameters
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(pixel_values, n_clusters, None, criteria, 10, 
                                        cv2.KMEANS_RANDOM_CENTERS)
        
        # Convert back to 8-bit values
        centers = np.uint8(centers)
        segmented = centers[labels.flatten()]
        segmented = segmented.reshape(img.shape)
        
        # Create label map
        label_map = labels.reshape(img.shape[:2])
        
        return segmented, label_map
    
    def watershed_segmentation(self, img, **kwargs):
        """
        Watershed algorithm for separating touching objects
        
        Parameters:
        - morph_iterations: iterations for morphological operations
        - dist_threshold: threshold for distance transform (0.0-1.0)
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply threshold
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Noise removal
        kernel = np.ones((3, 3), np.uint8)
        morph_iterations = kwargs.get('morph_iterations', 2)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=morph_iterations)
        
        # Sure background area
        sure_bg = cv2.dilate(opening, kernel, iterations=3)
        
        # Sure foreground area
        dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
        dist_threshold = kwargs.get('dist_threshold', 0.3)
        _, sure_fg = cv2.threshold(dist_transform, dist_threshold * dist_transform.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)
        
        # Unknown region
        unknown = cv2.subtract(sure_bg, sure_fg)
        
        # Marker labelling
        _, markers = cv2.connectedComponents(sure_fg)
        markers = markers + 1
        markers[unknown == 255] = 0
        
        # Apply watershed
        markers = cv2.watershed(img, markers)
        
        # Create result image
        result = img.copy()
        result[markers == -1] = [0, 0, 255]  # Mark boundaries in red
        
        return result, markers
    
    def contour_segmentation(self, img, **kwargs):
        """
        Contour-based segmentation
        
        Parameters:
        - threshold: binary threshold value
        - min_area: minimum contour area to keep
        - method: 'external' or 'tree' for hierarchy
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply threshold
        threshold_value = kwargs.get('threshold', 127)
        _, binary = cv2.threshold(gray, threshold_value, 255, cv2.THRESH_BINARY_INV)
        
        # Find contours
        mode = cv2.RETR_EXTERNAL if kwargs.get('method', 'external') == 'external' else cv2.RETR_TREE
        contours, hierarchy = cv2.findContours(binary, mode, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter by area
        min_area = kwargs.get('min_area', 100)
        filtered_contours = [cnt for cnt in contours if cv2.contourArea(cnt) > min_area]
        
        # Create visualization
        result = img.copy()
        mask = np.zeros(gray.shape, dtype=np.uint8)
        
        # Draw contours
        cv2.drawContours(result, filtered_contours, -1, (0, 255, 0), 2)
        cv2.drawContours(mask, filtered_contours, -1, 255, -1)
        
        return result, mask, filtered_contours
    
    def morphological_segmentation(self, img, operation='gradient', **kwargs):
        """
        Morphological operations for segmentation
        
        Parameters:
        - operation: 'gradient', 'tophat', 'blackhat', 'opening', 'closing'
        - kernel_size: size of morphological kernel
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        kernel_size = kwargs.get('kernel_size', 5)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        
        if operation == 'gradient':
            result = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
        elif operation == 'tophat':
            result = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
        elif operation == 'blackhat':
            result = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
        elif operation == 'opening':
            result = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel)
        elif operation == 'closing':
            result = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return result
    
    def region_growing(self, img, seed_point=None, threshold=10):
        """
        Region growing segmentation
        
        Parameters:
        - seed_point: (x, y) tuple, if None uses center
        - threshold: intensity difference threshold
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        
        # Use center if no seed point provided
        if seed_point is None:
            seed_point = (w // 2, h // 2)
        
        # Initialize
        segmented = np.zeros_like(gray, dtype=np.uint8)
        visited = np.zeros_like(gray, dtype=bool)
        
        # Seed intensity
        seed_intensity = gray[seed_point[1], seed_point[0]]
        
        # Queue for region growing
        queue = [seed_point]
        visited[seed_point[1], seed_point[0]] = True
        
        # 8-connectivity neighbors
        neighbors = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
        
        while queue:
            x, y = queue.pop(0)
            segmented[y, x] = 255
            
            # Check neighbors
            for dx, dy in neighbors:
                nx, ny = x + dx, y + dy
                
                if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                    if abs(int(gray[ny, nx]) - int(seed_intensity)) <= threshold:
                        queue.append((nx, ny))
                        visited[ny, nx] = True
        
        return segmented
    
    def grabcut_segmentation(self, img, rect=None, iterations=5):
        """
        GrabCut segmentation (interactive foreground extraction)
        
        Parameters:
        - rect: (x, y, width, height) bounding box, if None uses center region
        - iterations: number of GrabCut iterations
        """
        if rect is None:
            h, w = img.shape[:2]
            rect = (w // 4, h // 4, w // 2, h // 2)
        
        mask = np.zeros(img.shape[:2], np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        cv2.grabCut(img, mask, rect, bgd_model, fgd_model, iterations, cv2.GC_INIT_WITH_RECT)
        
        # Create binary mask
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
        result = img * mask2[:, :, np.newaxis]
        
        return result, mask2