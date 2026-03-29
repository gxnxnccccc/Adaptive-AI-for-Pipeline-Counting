import Segmentation
import cv2
import matplotlib.pyplot as plt

seg = Segmentation.Segmentation()

def visualize_edge_detection(img):
    """Visualize different edge detection methods"""
    fig, axes = plt.subplots(2, 2, figsize=(14, 12))
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Original
    axes[0, 0].imshow(img_rgb)
    axes[0, 0].set_title('Original Image', fontsize=14, fontweight='bold')
    axes[0, 0].axis('off')
    
    # Canny
    edges_canny = seg.edge_detection(img, method='canny', low_threshold=50, high_threshold=150)
    axes[0, 1].imshow(edges_canny, cmap='gray')
    axes[0, 1].set_title('Canny Edge Detection', fontsize=14, fontweight='bold')
    axes[0, 1].axis('off')
    
    # Sobel
    edges_sobel = seg.edge_detection(img, method='sobel', ksize=3)
    axes[1, 0].imshow(edges_sobel, cmap='gray')
    axes[1, 0].set_title('Sobel Edge Detection', fontsize=14, fontweight='bold')
    axes[1, 0].axis('off')
    
    # Laplacian
    edges_laplacian = seg.edge_detection(img, method='laplacian', ksize=3)
    axes[1, 1].imshow(edges_laplacian, cmap='gray')
    axes[1, 1].set_title('Laplacian Edge Detection', fontsize=14, fontweight='bold')
    axes[1, 1].axis('off')
    
    plt.suptitle('Edge Detection Methods Comparison', fontsize=16, fontweight='bold', y=0.98)
    plt.tight_layout()
    plt.show()

def visualize_threshold_methods(img):
    """Visualize different threshold methods"""
    fig, axes = plt.subplots(2, 3, figsize=(16, 11))
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Original
    axes[0, 0].imshow(img_rgb)
    axes[0, 0].set_title('Original Image', fontsize=14, fontweight='bold')
    axes[0, 0].axis('off')
    
    # Otsu
    thresh_otsu = seg.threshold_segmentation(img, method='otsu')
    axes[0, 1].imshow(thresh_otsu, cmap='gray')
    axes[0, 1].set_title('Otsu Thresholding', fontsize=14, fontweight='bold')
    axes[0, 1].axis('off')
    
    # Adaptive
    thresh_adaptive = seg.threshold_segmentation(img, method='adaptive', block_size=11, c=2)
    axes[0, 2].imshow(thresh_adaptive, cmap='gray')
    axes[0, 2].set_title('Adaptive Thresholding', fontsize=14, fontweight='bold')
    axes[0, 2].axis('off')
    
    # Binary
    thresh_binary = seg.threshold_segmentation(img, method='binary', threshold=127)
    axes[1, 0].imshow(thresh_binary, cmap='gray')
    axes[1, 0].set_title('Binary Thresholding (127)', fontsize=14, fontweight='bold')
    axes[1, 0].axis('off')
    
    # Multi-level
    thresh_multi = seg.threshold_segmentation(img, method='multi', levels=[85, 170])
    axes[1, 1].imshow(thresh_multi, cmap='gray')
    axes[1, 1].set_title('Multi-Level Thresholding', fontsize=14, fontweight='bold')
    axes[1, 1].axis('off')
    
    # Histogram
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    axes[1, 2].hist(gray.ravel(), 256, [0, 256])
    axes[1, 2].set_title('Intensity Histogram', fontsize=14, fontweight='bold')
    axes[1, 2].set_xlabel('Pixel Intensity')
    axes[1, 2].set_ylabel('Frequency')
    
    plt.suptitle('Thresholding Methods Comparison', fontsize=16, fontweight='bold', y=0.98)
    plt.tight_layout()
    plt.show()

def visualize_circle_detection(img):
    """Visualize circle detection for pipe ends"""
    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Original
    axes[0].imshow(img_rgb)
    axes[0].set_title('Original Image', fontsize=14, fontweight='bold')
    axes[0].axis('off')
    
    # Circle detection
    result, mask, circles = seg.circle_detection(img, dp=1, min_dist=20, 
                                                 param1=50, param2=30, 
                                                 min_radius=10, max_radius=50)
    result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
    
    axes[1].imshow(result_rgb)
    if circles is not None:
        axes[1].set_title(f'Detected Circles: {len(circles[0])}', fontsize=14, fontweight='bold')
    else:
        axes[1].set_title('No Circles Detected', fontsize=14, fontweight='bold')
    axes[1].axis('off')
    
    # Mask
    axes[2].imshow(mask, cmap='hot')
    axes[2].set_title('Circle Mask', fontsize=14, fontweight='bold')
    axes[2].axis('off')
    
    plt.suptitle('Circle Detection (Hough Transform)', fontsize=16, fontweight='bold')
    plt.tight_layout()
    plt.show()

def visualize_advanced_methods(img):
    """Visualize advanced segmentation methods"""
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Original
    axes[0, 0].imshow(img_rgb)
    axes[0, 0].set_title('Original Image', fontsize=14, fontweight='bold')
    axes[0, 0].axis('off')
    
    # K-means (3 clusters)
    kmeans_result, label_map = seg.kmeans_segmentation(img, n_clusters=3)
    axes[0, 1].imshow(cv2.cvtColor(kmeans_result, cv2.COLOR_BGR2RGB))
    axes[0, 1].set_title('K-Means (3 clusters)', fontsize=14, fontweight='bold')
    axes[0, 1].axis('off')
    
    # K-means label map
    axes[0, 2].imshow(label_map, cmap='viridis')
    axes[0, 2].set_title('K-Means Labels', fontsize=14, fontweight='bold')
    axes[0, 2].axis('off')
    
    # Watershed
    watershed_result, markers = seg.watershed_segmentation(img, morph_iterations=2, 
                                                           dist_threshold=0.3)
    axes[1, 0].imshow(cv2.cvtColor(watershed_result, cv2.COLOR_BGR2RGB))
    axes[1, 0].set_title('Watershed Segmentation', fontsize=14, fontweight='bold')
    axes[1, 0].axis('off')
    
    # Morphological Gradient
    morph_grad = seg.morphological_segmentation(img, operation='gradient', kernel_size=5)
    axes[1, 1].imshow(morph_grad, cmap='gray')
    axes[1, 1].set_title('Morphological Gradient', fontsize=14, fontweight='bold')
    axes[1, 1].axis('off')
    
    # Contours
    contour_result, contour_mask, contours = seg.contour_segmentation(img, threshold=127, 
                                                                       min_area=100)
    axes[1, 2].imshow(cv2.cvtColor(contour_result, cv2.COLOR_BGR2RGB))
    axes[1, 2].set_title(f'Contours ({len(contours)} found)', fontsize=14, fontweight='bold')
    axes[1, 2].axis('off')
    
    plt.suptitle('Advanced Segmentation Methods', fontsize=16, fontweight='bold', y=0.98)
    plt.tight_layout()
    plt.show()

def visualize_comparison_all(img):
    """Compare all major segmentation methods"""
    fig = plt.figure(figsize=(20, 16))
    gs = fig.add_gridspec(4, 4, hspace=0.3, wspace=0.3)
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Row 1: Original and Edge Detection
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.imshow(img_rgb)
    ax1.set_title('Original', fontsize=12, fontweight='bold')
    ax1.axis('off')
    
    ax2 = fig.add_subplot(gs[0, 1])
    edges = seg.edge_detection(img, method='canny')
    ax2.imshow(edges, cmap='gray')
    ax2.set_title('Canny Edges', fontsize=12, fontweight='bold')
    ax2.axis('off')
    
    ax3 = fig.add_subplot(gs[0, 2])
    thresh_otsu = seg.threshold_segmentation(img, method='otsu')
    ax3.imshow(thresh_otsu, cmap='gray')
    ax3.set_title('Otsu Threshold', fontsize=12, fontweight='bold')
    ax3.axis('off')
    
    ax4 = fig.add_subplot(gs[0, 3])
    thresh_adaptive = seg.threshold_segmentation(img, method='adaptive')
    ax4.imshow(thresh_adaptive, cmap='gray')
    ax4.set_title('Adaptive Threshold', fontsize=12, fontweight='bold')
    ax4.axis('off')
    
    # Row 2: Circle Detection and Morphological
    ax5 = fig.add_subplot(gs[1, 0])
    circle_result, _, _ = seg.circle_detection(img)
    ax5.imshow(cv2.cvtColor(circle_result, cv2.COLOR_BGR2RGB))
    ax5.set_title('Circle Detection', fontsize=12, fontweight='bold')
    ax5.axis('off')
    
    ax6 = fig.add_subplot(gs[1, 1])
    morph_grad = seg.morphological_segmentation(img, operation='gradient')
    ax6.imshow(morph_grad, cmap='gray')
    ax6.set_title('Morph Gradient', fontsize=12, fontweight='bold')
    ax6.axis('off')
    
    ax7 = fig.add_subplot(gs[1, 2])
    morph_tophat = seg.morphological_segmentation(img, operation='tophat')
    ax7.imshow(morph_tophat, cmap='gray')
    ax7.set_title('Top Hat', fontsize=12, fontweight='bold')
    ax7.axis('off')
    
    ax8 = fig.add_subplot(gs[1, 3])
    morph_blackhat = seg.morphological_segmentation(img, operation='blackhat')
    ax8.imshow(morph_blackhat, cmap='gray')
    ax8.set_title('Black Hat', fontsize=12, fontweight='bold')
    ax8.axis('off')
    
    # Row 3: K-means and Watershed
    ax9 = fig.add_subplot(gs[2, 0])
    kmeans_2, _ = seg.kmeans_segmentation(img, n_clusters=2)
    ax9.imshow(cv2.cvtColor(kmeans_2, cv2.COLOR_BGR2RGB))
    ax9.set_title('K-Means (2 clusters)', fontsize=12, fontweight='bold')
    ax9.axis('off')
    
    ax10 = fig.add_subplot(gs[2, 1])
    kmeans_3, _ = seg.kmeans_segmentation(img, n_clusters=3)
    ax10.imshow(cv2.cvtColor(kmeans_3, cv2.COLOR_BGR2RGB))
    ax10.set_title('K-Means (3 clusters)', fontsize=12, fontweight='bold')
    ax10.axis('off')
    
    ax11 = fig.add_subplot(gs[2, 2])
    kmeans_4, _ = seg.kmeans_segmentation(img, n_clusters=4)
    ax11.imshow(cv2.cvtColor(kmeans_4, cv2.COLOR_BGR2RGB))
    ax11.set_title('K-Means (4 clusters)', fontsize=12, fontweight='bold')
    ax11.axis('off')
    
    ax12 = fig.add_subplot(gs[2, 3])
    watershed_result, _ = seg.watershed_segmentation(img)
    ax12.imshow(cv2.cvtColor(watershed_result, cv2.COLOR_BGR2RGB))
    ax12.set_title('Watershed', fontsize=12, fontweight='bold')
    ax12.axis('off')
    
    # Row 4: Contours and Combined
    ax13 = fig.add_subplot(gs[3, 0])
    contour_result, _, _ = seg.contour_segmentation(img)
    ax13.imshow(cv2.cvtColor(contour_result, cv2.COLOR_BGR2RGB))
    ax13.set_title('Contours', fontsize=12, fontweight='bold')
    ax13.axis('off')
    
    ax14 = fig.add_subplot(gs[3, 1])
    grabcut_result, _ = seg.grabcut_segmentation(img)
    ax14.imshow(cv2.cvtColor(grabcut_result, cv2.COLOR_BGR2RGB))
    ax14.set_title('GrabCut', fontsize=12, fontweight='bold')
    ax14.axis('off')
    
    ax15 = fig.add_subplot(gs[3, 2])
    region_grow = seg.region_growing(img, threshold=15)
    ax15.imshow(region_grow, cmap='gray')
    ax15.set_title('Region Growing', fontsize=12, fontweight='bold')
    ax15.axis('off')
    
    ax16 = fig.add_subplot(gs[3, 3])
    # Combined: Canny + K-means
    edges_colored = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    combined = cv2.addWeighted(kmeans_3, 0.7, edges_colored, 0.3, 0)
    ax16.imshow(cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
    ax16.set_title('Combined (K-Means+Edges)', fontsize=12, fontweight='bold')
    ax16.axis('off')
    
    plt.suptitle('Complete Segmentation Methods Comparison', fontsize=18, fontweight='bold')
    plt.show()

def interactive_parameter_tuning(img, method):
    """Interactive parameter tuning for specific methods"""
    if method == 'circle':
        print("\n=== Circle Detection Parameter Tuning ===")
        print("Current parameters:")
        print("  dp=1, min_dist=20, param1=50, param2=30")
        print("  min_radius=10, max_radius=50")
        print("\nAdjusting param2 (accumulator threshold)...")
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 12))
        param2_values = [20, 30, 40, 50]
        
        for idx, p2 in enumerate(param2_values):
            result, _, circles = seg.circle_detection(img, param2=p2)
            result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
            ax = axes[idx // 2, idx % 2]
            ax.imshow(result_rgb)
            count = len(circles[0]) if circles is not None else 0
            ax.set_title(f'param2={p2} | Circles: {count}', fontsize=12, fontweight='bold')
            ax.axis('off')
        
        plt.suptitle('Circle Detection: param2 Sensitivity', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.show()
    
    elif method == 'kmeans':
        print("\n=== K-Means Clustering Parameter Tuning ===")
        print("Testing different numbers of clusters...")
        
        fig, axes = plt.subplots(2, 3, figsize=(16, 11))
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        axes[0, 0].imshow(img_rgb)
        axes[0, 0].set_title('Original', fontsize=12, fontweight='bold')
        axes[0, 0].axis('off')
        
        cluster_values = [2, 3, 4, 5, 6]
        for idx, k in enumerate(cluster_values):
            result, _ = seg.kmeans_segmentation(img, n_clusters=k)
            result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
            ax = axes[(idx + 1) // 3, (idx + 1) % 3]
            ax.imshow(result_rgb)
            ax.set_title(f'K={k} clusters', fontsize=12, fontweight='bold')
            ax.axis('off')
        
        plt.suptitle('K-Means: Number of Clusters', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.show()
    
    elif method == 'watershed':
        print("\n=== Watershed Parameter Tuning ===")
        print("Testing distance threshold values...")
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 12))
        threshold_values = [0.2, 0.3, 0.4, 0.5]
        
        for idx, thresh in enumerate(threshold_values):
            result, _ = seg.watershed_segmentation(img, dist_threshold=thresh)
            result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
            ax = axes[idx // 2, idx % 2]
            ax.imshow(result_rgb)
            ax.set_title(f'dist_threshold={thresh}', fontsize=12, fontweight='bold')
            ax.axis('off')
        
        plt.suptitle('Watershed: Distance Threshold Sensitivity', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.show()

if __name__ == '__main__':
    import os
    import random
    pic=[
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
    random_pic=random.choice(pic)

    img = cv2.imread(random_pic)
    
    if img is None:
        print("Error: Could not load image!")
        exit()
    
    print("=" * 70)
    print("SEGMENTATION METHODS FOR PIPE IMAGE")
    print("=" * 70)
    print("Choose mode:")
    print("1 - Edge Detection Comparison")
    print("2 - Thresholding Methods Comparison")
    print("3 - Circle Detection (for pipe ends)")
    print("4 - Advanced Methods (K-means, Watershed, Morphological)")
    print("5 - Complete Comparison (All methods)")
    print("6 - Interactive Parameter Tuning")
    print("=" * 70)
    
    choice = input("Enter choice (1-6): ").strip()
    
    if choice == '1':
        print("\n=== Edge Detection Methods ===")
        visualize_edge_detection(img)
        
    elif choice == '2':
        print("\n=== Thresholding Methods ===")
        visualize_threshold_methods(img)
        
    elif choice == '3':
        print("\n=== Circle Detection ===")
        visualize_circle_detection(img)
        
    elif choice == '4':
        print("\n=== Advanced Segmentation Methods ===")
        visualize_advanced_methods(img)
        
    elif choice == '5':
        print("\n=== Complete Comparison ===")
        visualize_comparison_all(img)
        
    elif choice == '6':
        print("\n=== Interactive Parameter Tuning ===")
        print("Choose method to tune:")
        print("  a - Circle Detection")
        print("  b - K-Means Clustering")
        print("  c - Watershed")
        sub_choice = input("Enter choice (a-c): ").strip().lower()
        
        if sub_choice == 'a':
            interactive_parameter_tuning(img, 'circle')
        elif sub_choice == 'b':
            interactive_parameter_tuning(img, 'kmeans')
        elif sub_choice == 'c':
            interactive_parameter_tuning(img, 'watershed')
        else:
            print("Invalid choice!")
    
    else:
        print("Invalid choice!")
    
    print("\n=== Processing Complete ===")