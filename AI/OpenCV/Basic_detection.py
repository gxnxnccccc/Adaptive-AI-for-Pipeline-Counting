import cv2
import numpy as np
import matplotlib.pyplot as plt
import random
from typing import Tuple, List, Dict

class HoughPipeDetector:
    """Hough Circle Transform based pipe detector with adaptive parameters"""
    
    def __init__(self):
        self.debug_info = {}
    
    def detect(self, image_path: str, 
               dp: float = 1.2,
               min_dist_ratio: float = 0.8,
               param1: int = 100,
               param2: int = 40,
               min_radius: int = 8,
               max_radius: int = 80,
               use_roi: bool = True,
               debug: bool = True) -> Dict:
        """
        Detect pipes using Hough Circle Transform
        
        Parameters:
        - dp: Inverse ratio of accumulator resolution (higher = faster but less accurate)
        - min_dist_ratio: Minimum distance between circles as ratio of radius
        - param1: Canny edge threshold (higher = fewer edges)
        - param2: Accumulator threshold (higher = fewer circles, more confident)
        - min_radius: Minimum circle radius in pixels
        - max_radius: Maximum circle radius in pixels
        - use_roi: Whether to crop ROI before detection
        """
        
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        self.debug_info = {'image_path': image_path, 'original_shape': img.shape}
        
        # Extract ROI if requested
        if use_roi:
            roi, offset = self._extract_roi(img)
            self.debug_info['roi_shape'] = roi.shape
            self.debug_info['roi_offset'] = offset
        else:
            roi = img.copy()
            offset = (0, 0)
        
        # Preprocessing
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # CLAHE for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray_eq = clahe.apply(gray)
        
        # Bilateral filter to reduce noise while preserving edges
        gray_filtered = cv2.bilateralFilter(gray_eq, 9, 75, 75)
        
        self.debug_info['gray'] = gray
        self.debug_info['gray_eq'] = gray_eq
        self.debug_info['gray_filtered'] = gray_filtered
        
        # Calculate adaptive minDist based on estimated pipe size
        avg_radius_estimate = (min_radius + max_radius) / 2
        min_dist = int(avg_radius_estimate * min_dist_ratio * 2)  # Diameter * ratio
        
        # Detect circles
        circles = cv2.HoughCircles(
            gray_filtered,
            cv2.HOUGH_GRADIENT,
            dp=dp,
            minDist=min_dist,
            param1=param1,
            param2=param2,
            minRadius=min_radius,
            maxRadius=max_radius
        )
        
        # Process results
        if circles is not None:
            circles = np.uint16(np.around(circles))
            
            # Filter circles based on quality metrics
            filtered_circles = self._filter_circles(circles[0], gray_eq, roi)
            
            # Adjust coordinates back to original image space
            if use_roi:
                filtered_circles = [(x + offset[0], y + offset[1], r) 
                                   for x, y, r in filtered_circles]
            
            pipe_count = len(filtered_circles)
        else:
            filtered_circles = []
            pipe_count = 0
        
        self.debug_info['raw_circles'] = circles
        self.debug_info['filtered_circles'] = filtered_circles
        self.debug_info['pipe_count'] = pipe_count
        self.debug_info['params'] = {
            'dp': dp, 'min_dist': min_dist, 'param1': param1, 'param2': param2,
            'min_radius': min_radius, 'max_radius': max_radius
        }
        
        # Create visualizations
        if debug:
            self._create_visualizations(img, roi, filtered_circles, offset if use_roi else None)
        
        return {
            'pipe_count': pipe_count,
            'circles': filtered_circles,
            'debug_info': self.debug_info
        }
    
    def _extract_roi(self, img: np.ndarray) -> Tuple[np.ndarray, Tuple[int, int]]:
        """Extract region of interest, excluding truck/background"""
        h, w = img.shape[:2]
        
        # Adaptive ROI based on aspect ratio
        aspect_ratio = w / h
        
        if aspect_ratio > 1.5:  # Wide image
            y1, y2 = int(0.15 * h), int(0.90 * h)
            x1, x2 = int(0.05 * w), int(0.95 * w)
        else:  # Standard image
            y1, y2 = int(0.20 * h), int(0.85 * h)
            x1, x2 = int(0.05 * w), int(0.95 * w)
        
        roi = img[y1:y2, x1:x2]
        offset = (x1, y1)
        
        return roi, offset
    
    def _filter_circles(self, circles: np.ndarray, gray: np.ndarray, 
                       roi: np.ndarray) -> List[Tuple[int, int, int]]:
        """Filter circles based on quality metrics"""
        
        if len(circles) == 0:
            return []
        
        filtered = []
        radii = circles[:, 2]
        
        # Calculate statistics for outlier detection
        if len(radii) > 3:
            q1 = np.percentile(radii, 25)
            q3 = np.percentile(radii, 75)
            iqr = q3 - q1
            lower_bound = q1 - 2.0 * iqr
            upper_bound = q3 + 2.0 * iqr
        else:
            lower_bound = radii.min()
            upper_bound = radii.max()
        
        avg_brightness = np.mean(gray)
        
        for circle in circles:
            x, y, r = circle
            
            # Skip if out of bounds
            if x - r < 0 or x + r >= gray.shape[1] or y - r < 0 or y + r >= gray.shape[0]:
                continue
            
            # Radius outlier filter
            if r < lower_bound or r > upper_bound:
                continue
            
            # Create mask for the circle
            mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.circle(mask, (x, y), int(r * 0.7), 255, -1)
            
            # Check mean intensity inside circle
            mean_inside = cv2.mean(gray, mask=mask)[0]
            
            # Create outer ring mask
            mask_outer = np.zeros(gray.shape, dtype=np.uint8)
            cv2.circle(mask_outer, (x, y), int(r * 1.2), 255, -1)
            cv2.circle(mask_outer, (x, y), r, 0, -1)
            mean_outside = cv2.mean(gray, mask=mask_outer)[0]
            
            # Check contrast
            contrast = abs(mean_inside - mean_outside)
            
            if contrast < 5:  # Too low contrast
                continue
            
            # Check if it's likely a pipe (darker than background)
            if mean_inside > avg_brightness * 1.3:
                continue
            
            # Check circularity using edge pixels
            mask_edge = np.zeros(gray.shape, dtype=np.uint8)
            cv2.circle(mask_edge, (x, y), r, 255, 2)
            
            # Count edge pixels
            edges = cv2.Canny(gray, 50, 150)
            edge_overlap = cv2.bitwise_and(edges, mask_edge)
            edge_ratio = np.sum(edge_overlap > 0) / (2 * np.pi * r)
            
            if edge_ratio < 0.15:  # Too few edge pixels on the circle
                continue
            
            filtered.append((int(x), int(y), int(r)))
        
        return filtered
    
    def _create_visualizations(self, img: np.ndarray, roi: np.ndarray, 
                              circles: List[Tuple[int, int, int]], 
                              offset: Tuple[int, int] = None):
        """Create visualization images"""
        
        # Draw on full image
        img_vis = img.copy()
        for (x, y, r) in circles:
            cv2.circle(img_vis, (x, y), r, (0, 255, 0), 2)
            cv2.circle(img_vis, (x, y), 2, (0, 0, 255), 3)
        
        # Draw on ROI (adjust coordinates)
        roi_vis = roi.copy()
        if offset is not None:
            for (x, y, r) in circles:
                x_roi = x - offset[0]
                y_roi = y - offset[1]
                if 0 <= x_roi < roi.shape[1] and 0 <= y_roi < roi.shape[0]:
                    cv2.circle(roi_vis, (x_roi, y_roi), r, (0, 255, 0), 2)
                    cv2.circle(roi_vis, (x_roi, y_roi), 2, (0, 0, 255), 3)
        else:
            roi_vis = img_vis.copy()
        
        self.debug_info['img_vis'] = img_vis
        self.debug_info['roi_vis'] = roi_vis
    
    def visualize(self):
        """Display detection results"""
        if 'img_vis' not in self.debug_info:
            print("No visualization available. Run detect() first.")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        
        # Original image
        axes[0, 0].imshow(cv2.cvtColor(cv2.imread(self.debug_info['image_path']), 
                                       cv2.COLOR_BGR2RGB))
        axes[0, 0].set_title("Original Image")
        axes[0, 0].axis('off')
        
        # Preprocessed (CLAHE + bilateral)
        axes[0, 1].imshow(self.debug_info['gray_filtered'], cmap='gray')
        axes[0, 1].set_title("Preprocessed (CLAHE + Bilateral)")
        axes[0, 1].axis('off')
        
        # ROI with detection
        axes[1, 0].imshow(cv2.cvtColor(self.debug_info['roi_vis'], cv2.COLOR_BGR2RGB))
        axes[1, 0].set_title(f"ROI Detection: {self.debug_info['pipe_count']} pipes")
        axes[1, 0].axis('off')
        
        # Full image with detection
        axes[1, 1].imshow(cv2.cvtColor(self.debug_info['img_vis'], cv2.COLOR_BGR2RGB))
        axes[1, 1].set_title(f"Full Image: {self.debug_info['pipe_count']} pipes")
        axes[1, 1].axis('off')
        
        plt.tight_layout()
        plt.show()
    
    def print_summary(self):
        """Print detection summary"""
        print(f"\n{'='*70}")
        print(f"  HOUGH CIRCLE DETECTION SUMMARY")
        print(f"{'='*70}")
        print(f"Image: {self.debug_info['image_path']}")
        print(f"Original Shape: {self.debug_info['original_shape']}")
        if 'roi_shape' in self.debug_info:
            print(f"ROI Shape: {self.debug_info['roi_shape']}")
        
        print(f"\nParameters:")
        for key, value in self.debug_info['params'].items():
            print(f"  - {key}: {value}")
        
        raw_count = len(self.debug_info['raw_circles'][0]) if self.debug_info['raw_circles'] is not None else 0
        print(f"\nDetection Results:")
        print(f"  - Raw circles detected: {raw_count}")
        print(f"  - After filtering: {self.debug_info['pipe_count']}")
        print(f"  - Filtered out: {raw_count - self.debug_info['pipe_count']}")
        
        if self.debug_info['pipe_count'] > 0:
            radii = [r for _, _, r in self.debug_info['filtered_circles']]
            print(f"\nRadius Statistics:")
            print(f"  - Mean: {np.mean(radii):.1f} pixels")
            print(f"  - Std: {np.std(radii):.1f} pixels")
            print(f"  - Range: {min(radii)} - {max(radii)} pixels")
        
        print(f"\n{'='*70}")
        print(f"  FINAL: {self.debug_info['pipe_count']} PIPES")
        print(f"{'='*70}\n")


def auto_tune_parameters(image_path: str, target_range: Tuple[int, int] = (30, 100)):
    """
    Automatically tune parameters to get pipe count in target range
    
    Parameters:
    - image_path: Path to image
    - target_range: (min, max) acceptable pipe count
    
    Returns best configuration
    """
    
    print(f"Auto-tuning parameters for: {image_path}")
    print(f"Target range: {target_range[0]}-{target_range[1]} pipes\n")
    
    # Parameter grid to search
    param2_values = [35, 40, 45, 50, 55]
    min_dist_ratios = [0.6, 0.8, 1.0, 1.2]
    
    best_config = None
    best_count = 0
    results = []
    
    for param2 in param2_values:
        for min_dist_ratio in min_dist_ratios:
            detector = HoughPipeDetector()
            result = detector.detect(
                image_path,
                param2=param2,
                min_dist_ratio=min_dist_ratio,
                debug=False
            )
            
            count = result['pipe_count']
            results.append((param2, min_dist_ratio, count))
            
            print(f"param2={param2}, min_dist_ratio={min_dist_ratio:.1f} -> {count} pipes")
            
            # Check if in target range
            if target_range[0] <= count <= target_range[1]:
                best_config = {'param2': param2, 'min_dist_ratio': min_dist_ratio}
                best_count = count
                print(f"  ✓ In target range!")
                break
        
        if best_config:
            break
    
    if best_config:
        print(f"\n✓ Best config found: {best_config} -> {best_count} pipes")
    else:
        # Find closest to target
        target_mid = (target_range[0] + target_range[1]) / 2
        best_idx = min(range(len(results)), 
                      key=lambda i: abs(results[i][2] - target_mid))
        best_config = {
            'param2': results[best_idx][0],
            'min_dist_ratio': results[best_idx][1]
        }
        best_count = results[best_idx][2]
        print(f"\n⚠ No config in range. Closest: {best_config} -> {best_count} pipes")
    
    return best_config, best_count


# =============================================================================
# USAGE EXAMPLES
# =============================================================================
if __name__ == "__main__":
    list_path = [
        "./test_pic/DO25110210_4_nikhon.jpg",
        "./test_pic/DO25110213_1_nikhon.jpg",
        "./test_pic/DO25110220_1_Pittawat.jpg",
        "./test_pic/DO25110257_3_Pittawat.jpg",
        "./test_pic/DO25110261_1_Pittawat.jpg",
        "./test_pic/DO25110277_2_Pittawat.jpg",
        "./test_pic/DO25110284_2_Pittawat.jpg",
        "./test_pic/Front_pipe.webp",
        "./test_pic/Metal_Pipe.jpg"
    ]
    
    img_path = list_path[8]  # Change index to test different images
    
    # Example 1: Basic usage with improved defaults
    print("="*70)
    print("EXAMPLE 1: Basic Detection")
    print("="*70)
    
    detector = HoughPipeDetector()
    result = detector.detect(
        img_path,
        param2=45,           # Higher = more selective (fewer circles)
        min_dist_ratio=1.0,  # Circles must be at least 1 diameter apart
        min_radius=8,
        max_radius=60
    )
    
    detector.print_summary()
    detector.visualize()
    
    # Example 2: Auto-tune parameters
    print("\n" + "="*70)
    print("EXAMPLE 2: Auto-tuning")
    print("="*70 + "\n")
    
    best_config, count = auto_tune_parameters(img_path, target_range=(35, 40))
    
    # Use best config
    detector2 = HoughPipeDetector()
    result2 = detector2.detect(img_path, **best_config)
    detector2.print_summary()
    detector2.visualize()