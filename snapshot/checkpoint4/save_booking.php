<?php
header('Content-Type: application/json');

$bookingsFile = 'bookings.json';
$inputData = file_get_contents('php://input');

if ($inputData) {
    // Acquire a file lock to prevent concurrent writes
    $fp = fopen($bookingsFile, 'c+');
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        fwrite($fp, $inputData);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Could not acquire lock']);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'No data received']);
}
?>
